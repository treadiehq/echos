import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    // Debug: Log connection string structure (hide password)
    try {
      const url = new URL(connectionString);
      const maskedPassword = url.password ? '***' + url.password.slice(-4) : 'NONE';
      console.log(`🔍 Connecting to: ${url.protocol}//${url.username}:${maskedPassword}@${url.host}${url.pathname}`);
    } catch (e) {
      console.log('🔍 DATABASE_URL format invalid');
    }

    this.pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async onModuleInit() {
    try {
      // Test connection
      await this.pool.query('SELECT NOW()');
      console.log('✅ Database connected successfully');
      
      // Run migrations
      await this.runMigrations();
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async query(text: string, params?: any[]) {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      if (process.env.NODE_ENV === 'development') {
        console.log('Query executed:', { text: text.substring(0, 100), duration, rows: result.rowCount });
      }
      
      return result;
    } catch (error) {
      console.error('Database query error:', { text, error });
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
      console.log('✅ Database migrations completed');
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  getPool() {
    return this.pool;
  }
}

