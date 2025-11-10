import type { Agent, AgentContext, AgentInput, AgentResult } from "../types";
import { DatabaseClient } from "../lib/database";
import { loadConfig } from "../config";
import { createLLMClient } from "../lib/llm";

/**
 * Enhanced DB Agent:
 * - Executes real SQL queries against PostgreSQL/SQLite
 * - Supports parameterized queries for safety
 * - Tracks query performance metrics
 */
export const db_agent: Agent = {
  name: "db_agent",
  kind: "worker",
  async handle(ctx: AgentContext, input: AgentInput): Promise<AgentResult> {
    ctx.log("db_agent received", input);
    
    try {
      // Try to extract explicit SQL query first
      let sql = extractSQL(input.message);
      const params = input.payload?.params as any[] | undefined;
      let llmCost = 0;

      // If no explicit SQL found, generate from natural language
      if (!sql) {
        ctx.log("db_agent: No explicit SQL found, generating from natural language", { message: input.message });
        
        const config = ctx.config ? ctx.config as ReturnType<typeof loadConfig> : loadConfig();
        
        // Check if LLM is available
        if (!config.openaiApiKey && !config.anthropicApiKey) {
          ctx.log("db_agent: No LLM configured, cannot generate SQL");
          return {
            ok: false,
            message: "❌ No SQL query found. Try asking: 'Query the users table' or 'SELECT * FROM users LIMIT 10'",
            payload: { 
              error: "NO_SQL_AND_NO_LLM",
              suggestion: "Either provide explicit SQL or configure an LLM API key for auto-generation",
              examples: [
                "Get all users from the users table",
                "SELECT * FROM orders WHERE date > '2024-01-01'",
                "Query the products table"
              ],
              setup: {
                llm: "Add OPENAI_API_KEY or ANTHROPIC_API_KEY to .env",
                explicit_sql: "Or write SQL directly in your message"
              }
            }
          };
        }

        const llm = createLLMClient(config);
        const sqlGenResponse = await llm.chat([
          {
            role: "system",
            content: `You are a SQL query generator. Generate a safe SELECT query based on the user's request.
Available tables: users, orders, products, analytics
Always include a reasonable LIMIT clause (max 100 rows).
Return ONLY the SQL query, no explanation.`
          },
          {
            role: "user",
            content: input.message
          }
        ], { temperature: 0, maxTokens: 150 });

        sql = sqlGenResponse.content.trim().replace(/```sql|```/g, '').trim();
        llmCost = sqlGenResponse.metadata.cost || 0;
        
        ctx.log("db_agent: Generated SQL", { sql, cost: llmCost });
      } else {
      ctx.log("db_agent: Extracted SQL", { sql });
      }

      // Get guardrails from workflow config
      const agentConfig = ctx.workflow.agents.find(a => a.name === "db_agent");
      const guardrails = agentConfig?.policy?.guardrails;

      ctx.log("db_agent: Guardrails loaded", { guardrails });

      // Enforce guardrails BEFORE DB check
      if (guardrails) {
        const violation = validateSQL(sql, guardrails);
        if (violation) {
          ctx.log("db_agent blocked: SQL guardrail violation", { sql, violation });
          
          // Provide actionable fix suggestions
          let suggestion = "";
          if (violation.includes("Operation not allowed")) {
            suggestion = "Add the operation to workflow.yaml → db_agent → guardrails → allowedOperations";
          } else if (violation.includes("Table not allowed")) {
            suggestion = "Add your table to workflow.yaml → db_agent → guardrails → allowedTables";
          } else if (violation.includes("WHERE clause required")) {
            suggestion = "Add a WHERE clause to your UPDATE/DELETE query";
          }
          
          return {
            ok: false,
            message: `Security: ${violation}`,
            payload: { 
              error: "GUARDRAIL_VIOLATION", 
              violation,
              sql,
              suggestion,
              guardrails,
              docs: "See workflow.yaml to configure guardrails"
            }
          };
        }
      }

      // Now check database configuration
      const config = ctx.config ? ctx.config as ReturnType<typeof loadConfig> : loadConfig();
      const db = new DatabaseClient(config.databaseUrl);

      if (!db.isConfigured()) {
        // Fallback to mock data if no DB configured (guardrails already checked)
        ctx.log("No database configured, returning mock data");
        const mockData = [
          { id: 1, name: "Alice Johnson", email: "alice@example.com", created_at: "2024-01-15" },
          { id: 2, name: "Bob Smith", email: "bob@example.com", created_at: "2024-02-20" },
          { id: 3, name: "Charlie Davis", email: "charlie@example.com", created_at: "2024-03-10" }
        ];
        return {
          ok: true,
          message: `Mock query returned ${mockData.length} rows (no database configured)`,
          payload: { 
            rows: mockData,
            rowCount: mockData.length,
            sql
          },
          cost: 0.5 + llmCost
        };
      }

      // Execute the query
      const result = await db.query(sql, params);

      ctx.log("db_agent executed query", { 
        rowCount: result.rowCount,
        duration: result.metadata.duration 
      });

      return {
        ok: true,
        message: `Query executed successfully: ${result.rowCount} rows`,
        payload: { 
          rows: result.rows,
          rowCount: result.rowCount,
          fields: result.fields.map(f => ({ name: f.name, dataType: f.dataTypeID })),
          sql // Include the executed SQL in the output
        },
        metadata: result.metadata,
        cost: 0.5 + llmCost  // abstract cost + LLM cost
      };
    } catch (error) {
      ctx.log("db_agent error", { error: error instanceof Error ? error.message : String(error) });
      return {
        ok: false,
        message: `Database error: ${error instanceof Error ? error.message : String(error)}`,
        payload: { error: String(error) }
      };
    }
  }
};

/**
 * Extract explicit SQL query from message
 * Only matches SQL in code blocks or SQL that starts at beginning of message
 */
function extractSQL(message: string): string | null {
  // Try to extract SQL from code blocks first
    const codeBlockMatch = message.match(/```(?:sql)?\s*([\s\S]+?)```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }
    
  // Only match SQL at the START of the message (not in the middle)
  // This prevents matching "create" in "create a summary"
  const sqlMatch = message.match(/^\s*(SELECT|INSERT|UPDATE|DELETE)\b[\s\S]+?$/i);
    if (sqlMatch) {
      return sqlMatch[0].trim();
  }
  
  return null;
}

/**
 * Validate SQL against guardrails
 * Returns violation message if invalid, null if valid
 */
function validateSQL(sql: string, guardrails: any): string | null {
  const sqlUpper = sql.toUpperCase();
  
  // Check allowed operations
  if (guardrails.allowedOperations && guardrails.allowedOperations.length > 0) {
    const operation = (sqlUpper.match(/^(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TRUNCATE)/)?.[1]) || '';
    
    if (!guardrails.allowedOperations.includes(operation)) {
      return `Operation not allowed: ${operation}. Allowed: ${guardrails.allowedOperations.join(', ')}`;
    }
  }
  
  // Check allowed tables
  if (guardrails.allowedTables && guardrails.allowedTables.length > 0) {
    // Extract table names from SQL (simplified - matches FROM/INTO/UPDATE <table>)
    const tableMatches = sql.match(/(?:FROM|INTO|UPDATE|JOIN)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi);
    
    if (tableMatches) {
      for (const match of tableMatches) {
        const tableName = match.split(/\s+/)[1].toLowerCase();
        
        if (!guardrails.allowedTables.some((allowed: string) => allowed.toLowerCase() === tableName)) {
          return `Table not allowed: ${tableName}. Allowed: ${guardrails.allowedTables.join(', ')}`;
        }
      }
    }
  }
  
  // Check for WHERE clause requirement on UPDATE/DELETE
  if (guardrails.requireWhere) {
    if ((sqlUpper.includes('UPDATE') || sqlUpper.includes('DELETE')) && !sqlUpper.includes('WHERE')) {
      return 'WHERE clause required for UPDATE/DELETE operations';
    }
  }
  
  // Block dangerous operations
  const dangerousPatterns = [
    /DROP\s+TABLE/i,
    /DROP\s+DATABASE/i,
    /TRUNCATE/i,
    /ALTER\s+TABLE.*DROP/i,
    /DELETE.*FROM.*WHERE.*1\s*=\s*1/i,  // DELETE FROM x WHERE 1=1
    /UPDATE.*SET.*WHERE.*1\s*=\s*1/i,   // UPDATE x SET y WHERE 1=1
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(sql)) {
      return `Dangerous SQL pattern detected: ${pattern.source}`;
    }
  }
  
  return null;
}

