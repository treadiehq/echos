import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Pool, PoolConfig } from 'pg';
import fs from 'fs';
import path from 'path';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;
  private readonly logger = new Logger(DatabaseService.name);
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    // Debug: Log connection string structure (hide password)
    try {
      const url = new URL(connectionString);
      const maskedPassword = url.password ? '***' + url.password.slice(-4) : 'NONE';
      this.logger.log(`Connecting to: ${url.protocol}//${url.username}:${maskedPassword}@${url.host}${url.pathname}`);
    } catch (e) {
      this.logger.warn('DATABASE_URL format invalid');
    }

    // PERFORMANCE: Optimized connection pool settings
    const poolConfig: PoolConfig = {
      connectionString,
      // Connection limits
      max: parseInt(process.env.DB_POOL_MAX || '20'),           // Max connections
      min: parseInt(process.env.DB_POOL_MIN || '2'),            // Keep min connections warm
      
      // Timeouts
      idleTimeoutMillis: 30000,       // Close idle connections after 30s
      connectionTimeoutMillis: 5000,  // Fail fast if can't connect in 5s
      
      // Statement timeout to prevent runaway queries
      statement_timeout: 30000,       // 30 second max query time
      
      // Keep connections alive
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    };

    this.pool = new Pool(poolConfig);

    // PERFORMANCE: Handle pool errors gracefully
    this.pool.on('error', (err) => {
      this.logger.error('Unexpected pool error:', err.message);
    });

    // Log pool stats periodically in development
    if (process.env.NODE_ENV === 'development') {
      setInterval(() => {
        this.logger.debug(`Pool stats: total=${this.pool.totalCount}, idle=${this.pool.idleCount}, waiting=${this.pool.waitingCount}`);
      }, 60000);
    }
  }

  async onModuleInit() {
    try {
      // Test connection
      await this.pool.query('SELECT NOW()');
      this.logger.log('✅ Database connected successfully');
      
      // Run migrations
      await this.runMigrations();
      
      // PERFORMANCE: Start periodic cleanup job
      await this.startCleanupJob();
    } catch (error) {
      this.logger.error('❌ Database connection failed');
      throw error;
    }
  }

  async onModuleDestroy() {
    // Stop cleanup job
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    await this.pool.end();
  }

  /**
   * PERFORMANCE: Periodic cleanup of expired data
   * Runs every hour to clean up:
   * - Expired sessions
   * - Used/expired magic links
   */
  private async startCleanupJob() {
    // Run cleanup immediately on startup
    await this.runCleanup();

    // Then run every hour
    const ONE_HOUR = 60 * 60 * 1000;
    this.cleanupInterval = setInterval(async () => {
      await this.runCleanup();
    }, ONE_HOUR);

    this.logger.log('🧹 Cleanup job scheduled (hourly)');
  }

  private async runCleanup() {
    try {
      // Cleanup expired sessions
      const sessionsResult = await this.pool.query(
        `DELETE FROM sessions WHERE expires_at < NOW()`
      );
      
      // Cleanup old magic links (used or expired > 24 hours ago)
      const magicLinksResult = await this.pool.query(
        `DELETE FROM magic_links 
         WHERE (used_at IS NOT NULL AND used_at < NOW() - INTERVAL '1 day')
            OR (expires_at < NOW() - INTERVAL '1 day')`
      );

      const totalCleaned = (sessionsResult.rowCount || 0) + (magicLinksResult.rowCount || 0);
      
      if (totalCleaned > 0) {
        this.logger.log(`🧹 Cleanup: removed ${sessionsResult.rowCount} sessions, ${magicLinksResult.rowCount} magic links`);
      }
    } catch (error) {
      this.logger.error('Cleanup job failed:', error);
    }
  }

  async query(text: string, params?: any[]) {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      // PERFORMANCE: Log slow queries
      if (duration > 1000) {
        this.logger.warn(`Slow query (${duration}ms): ${text.substring(0, 100)}...`);
      } else if (process.env.NODE_ENV === 'development' && process.env.LOG_QUERIES === 'true') {
        this.logger.debug(`Query (${duration}ms): ${text.substring(0, 80)}... [${result.rowCount} rows]`);
      }
      
      return result;
    } catch (error: any) {
      this.logger.error(`Query failed: ${text.substring(0, 100)}... Error: ${error.message}`);
      throw error;
    }
  }

  async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async runMigrations() {
    try {
      const schemaPath = path.join(__dirname, 'schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      
      await this.pool.query(schema);
      this.logger.log('✅ Database schema migrations completed');

      // PERFORMANCE: Run performance optimization migrations (optional)
      const perfOptPath = path.join(__dirname, 'migrations', 'performance-optimizations.sql');
      if (fs.existsSync(perfOptPath)) {
        try {
          const perfOpt = fs.readFileSync(perfOptPath, 'utf8');
          await this.pool.query(perfOpt);
          this.logger.log('✅ Performance optimizations applied');
        } catch (perfError: any) {
          // Don't fail if performance optimizations have issues (may already be applied)
          this.logger.warn(`Performance optimizations warning: ${perfError.message}`);
        }
      }
    } catch (error: any) {
      this.logger.error(`Migration failed: ${error.message}`);
      throw error;
    }
  }

  getPool() {
    return this.pool;
  }

  /**
   * PERFORMANCE: Get pool statistics for monitoring
   */
  getPoolStats() {
    return {
      totalConnections: this.pool.totalCount,
      idleConnections: this.pool.idleCount,
      waitingClients: this.pool.waitingCount,
    };
  }

  /**
   * PERFORMANCE: Manual vacuum for maintenance windows
   * Should be called during low-traffic periods
   */
  async vacuum(tableName?: string) {
    if (tableName) {
      // Validate table name to prevent injection
      const validTables = ['traces', 'sessions', 'magic_links', 'api_keys', 'workflows', 'users', 'organizations', 'org_members'];
      if (!validTables.includes(tableName)) {
        throw new Error(`Invalid table name: ${tableName}`);
      }
      await this.pool.query(`VACUUM ANALYZE ${tableName}`);
      this.logger.log(`Vacuumed table: ${tableName}`);
    } else {
      await this.pool.query('VACUUM ANALYZE');
      this.logger.log('Vacuumed all tables');
    }
  }

  /**
   * PERFORMANCE: Clean up old traces by organization
   */
  async cleanupOldTraces(orgId: string, retentionDays: number = 90): Promise<number> {
    const result = await this.pool.query(
      `DELETE FROM traces 
       WHERE org_id = $1 
       AND created_at < NOW() - INTERVAL '1 day' * $2`,
      [orgId, Math.max(1, Math.min(365, retentionDays))]
    );
    return result.rowCount || 0;
  }
}

