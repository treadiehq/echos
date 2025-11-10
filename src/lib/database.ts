import pg from "pg";
import type { StepMetadata } from "../types.js";

const { Pool } = pg;

export interface QueryResult {
  rows: any[];
  rowCount: number;
  fields: any[];
  metadata: StepMetadata;
}

export class DatabaseClient {
  private pool: pg.Pool | null = null;
  private type: "postgres" | "sqlite" | null = null;

  constructor(private connectionString?: string) {
    if (!connectionString) {
      return;
    }

    if (connectionString.startsWith("postgresql://") || connectionString.startsWith("postgres://")) {
      this.type = "postgres";
      this.pool = new Pool({ connectionString });
    } else if (connectionString.startsWith("sqlite://")) {
      this.type = "sqlite";
      // SQLite support would go here (using better-sqlite3)
      throw new Error("SQLite support not yet implemented - use PostgreSQL");
    }
  }

  async query(sql: string, params?: any[]): Promise<QueryResult> {
    if (!this.pool) {
      throw new Error("Database not configured. Set DATABASE_URL environment variable.");
    }

    const startTime = Date.now();
    
    try {
      const result = await this.pool.query(sql, params);
      const duration = Date.now() - startTime;

      return {
        rows: result.rows,
        rowCount: result.rowCount ?? 0,
        fields: result.fields,
        metadata: {
          duration,
          provider: this.type ?? undefined,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      throw new Error(`Database query failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
  }

  isConfigured(): boolean {
    return this.pool !== null;
  }
}

