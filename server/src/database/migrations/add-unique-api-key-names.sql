-- Migration: Add unique constraint for API key names per organization
-- This ensures that API key names are unique within an organization for active keys

-- Create a partial unique index that enforces uniqueness only for non-revoked keys
-- This allows reusing names after a key is revoked/deleted
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_unique_name_per_org 
  ON api_keys(org_id, name) 
  WHERE revoked_at IS NULL;

