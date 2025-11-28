-- ============================================================================
-- PERFORMANCE OPTIMIZATIONS FOR ECHOS DATABASE
-- Run this migration after initial schema setup
--
-- SAFETY NOTES:
-- - All operations are idempotent (safe to run multiple times)
-- - Uses IF EXISTS / IF NOT EXISTS to prevent errors
-- - Uses CONCURRENTLY where possible (requires no locks)
-- - Does NOT drop tables or delete data
-- - Only modifies indexes and settings
-- ============================================================================

-- Ensure we're not in a transaction (required for CONCURRENTLY)
-- If running in psql: \set ON_ERROR_STOP on

-- ============================================================================
-- 1. COMPOUND INDEXES FOR MULTI-COLUMN QUERIES
-- ============================================================================

-- Traces: Most common query is by org_id + created_at DESC
-- This compound index covers: listTraces, deleteOldTraces
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_traces_org_created 
  ON traces(org_id, created_at DESC);

-- Traces: Query by workflow_id + org_id (getTracesByWorkflow)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_traces_workflow_org_created 
  ON traces(workflow_id, org_id, created_at DESC) 
  WHERE workflow_id IS NOT NULL;

-- Workflows: Query by org_id + name is common
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflows_org_name 
  ON workflows(org_id, name);

-- Sessions: Token lookup with expiry check
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_token_expires 
  ON sessions(token, expires_at);

-- ============================================================================
-- 2. PARTIAL INDEXES FOR FREQUENTLY QUERIED SUBSETS
-- ============================================================================

-- Active sessions only (non-expired) - most session queries only care about valid sessions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_active 
  ON sessions(token) 
  WHERE expires_at > NOW();

-- Valid magic links (not used, not expired) - the most common lookup pattern
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_magic_links_valid 
  ON magic_links(token) 
  WHERE used_at IS NULL AND expires_at > NOW();

-- Active API keys (not revoked) - most API key lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_keys_active 
  ON api_keys(key_prefix) 
  WHERE revoked_at IS NULL;

-- ============================================================================
-- 3. JSONB INDEXES FOR TRACES
-- ============================================================================

-- GIN index on traces.data for flexible JSONB queries
-- Useful if you need to search traces by any field in the data
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_traces_data_gin 
  ON traces USING GIN (data);

-- Specific index on taskId if frequently queried
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_traces_task_id 
  ON traces((data->>'taskId'));

-- Index on status for filtering completed/error traces
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_traces_status 
  ON traces((data->>'status'));

-- ============================================================================
-- 4. BRIN INDEX FOR TIME-SERIES DATA
-- ============================================================================

-- BRIN (Block Range Index) is very efficient for time-series data
-- Much smaller than B-tree, great for range queries on created_at
-- Note: Only effective if data is inserted roughly in time order
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_traces_created_brin 
  ON traces USING BRIN (created_at);

-- ============================================================================
-- 5. COVERING INDEXES (INCLUDE columns to avoid table lookups)
-- ============================================================================

-- Sessions: Include user_id to avoid table lookup for auth checks
DROP INDEX IF EXISTS idx_sessions_token;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_token_covering 
  ON sessions(token) 
  INCLUDE (user_id, expires_at);

-- API keys: Include org_id and created_by to avoid table lookup
DROP INDEX IF EXISTS idx_api_keys_prefix;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_keys_prefix_covering 
  ON api_keys(key_prefix) 
  INCLUDE (org_id, created_by, key_hash)
  WHERE revoked_at IS NULL;

-- ============================================================================
-- 6. AUTO-VACUUM TUNING FOR HIGH-WRITE TABLES
-- ============================================================================

-- Traces table: High write volume, needs aggressive vacuuming
ALTER TABLE traces SET (
  autovacuum_vacuum_scale_factor = 0.05,  -- Vacuum at 5% dead tuples (default 20%)
  autovacuum_analyze_scale_factor = 0.02, -- Analyze at 2% changes (default 10%)
  autovacuum_vacuum_cost_delay = 10,      -- Faster vacuum (default 20ms)
  autovacuum_vacuum_cost_limit = 1000     -- More aggressive (default 200)
);

-- Sessions table: Frequent updates (last_active_at)
ALTER TABLE sessions SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);

-- Magic links: Frequent inserts, deletes after expiry
ALTER TABLE magic_links SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);

-- ============================================================================
-- 7. TABLE STATISTICS FOR BETTER QUERY PLANNING
-- ============================================================================

-- Increase statistics target for frequently filtered columns
ALTER TABLE traces ALTER COLUMN org_id SET STATISTICS 500;
ALTER TABLE traces ALTER COLUMN workflow_id SET STATISTICS 500;
ALTER TABLE traces ALTER COLUMN created_at SET STATISTICS 500;

ALTER TABLE sessions ALTER COLUMN token SET STATISTICS 500;
ALTER TABLE sessions ALTER COLUMN expires_at SET STATISTICS 500;

ALTER TABLE api_keys ALTER COLUMN key_prefix SET STATISTICS 500;

-- Analyze tables to update statistics
ANALYZE traces;
ANALYZE sessions;
ANALYZE magic_links;
ANALYZE api_keys;
ANALYZE workflows;
ANALYZE users;
ANALYZE organizations;
ANALYZE org_members;

-- ============================================================================
-- 8. MAINTENANCE: CLEANUP EXPIRED DATA
-- ============================================================================

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM sessions WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired/used magic links (older than 24 hours)
CREATE OR REPLACE FUNCTION cleanup_old_magic_links()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM magic_links 
  WHERE (used_at IS NOT NULL AND used_at < NOW() - INTERVAL '1 day')
     OR (expires_at < NOW() - INTERVAL '1 day');
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old traces (configurable retention)
CREATE OR REPLACE FUNCTION cleanup_old_traces(retention_days INTEGER DEFAULT 90)
RETURNS TABLE(org_id UUID, deleted_count BIGINT) AS $$
BEGIN
  RETURN QUERY
  WITH deleted AS (
    DELETE FROM traces 
    WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL
    RETURNING traces.org_id
  )
  SELECT d.org_id, COUNT(*) as deleted_count
  FROM deleted d
  GROUP BY d.org_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 9. QUERY HINTS / PREPARED STATEMENTS SUPPORT
-- ============================================================================

-- Create a function to get trace with org check (common pattern)
-- Using a function can help with plan caching
CREATE OR REPLACE FUNCTION get_trace_secure(p_trace_id UUID, p_org_id UUID)
RETURNS traces AS $$
  SELECT * FROM traces WHERE id = p_trace_id AND org_id = p_org_id;
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- 10. EXTENSION FOR BETTER UUID PERFORMANCE (if not already enabled)
-- ============================================================================

-- pgcrypto for gen_random_uuid() - usually already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- NOTES:
-- 
-- 1. Run CONCURRENTLY indexes during low-traffic periods
-- 2. Monitor with: SELECT * FROM pg_stat_user_indexes;
-- 3. Check bloat with: SELECT * FROM pg_stat_user_tables;
-- 4. Schedule cleanup functions via pg_cron or application cron:
--    SELECT cleanup_expired_sessions();
--    SELECT cleanup_old_magic_links();
--    SELECT * FROM cleanup_old_traces(90);
--
-- For production, consider:
-- - Table partitioning for traces (by month)
-- - Read replicas for heavy read workloads
-- - Connection pooling with PgBouncer
-- - Regular VACUUM FULL during maintenance windows
-- ============================================================================

