import type { Agent, AgentContext, AgentInput, AgentResult } from "../types.js";
import { DatabaseClient } from "../lib/database.js";
import { loadConfig } from "../config.js";
import { createLLMClient } from "../lib/llm.js";

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
 * SECURITY: Uses non-backtracking patterns to prevent ReDoS
 */
function extractSQL(message: string): string | null {
  // SECURITY: Limit message length to prevent ReDoS
  if (message.length > 50000) {
    return null;
  }

  // Try to extract SQL from code blocks first
  // SECURITY: Non-greedy match with bounded repetition
  const codeBlockMatch = message.match(/```(?:sql)?\n([^`]+)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
    
  // Only match SQL at the START of the message (not in the middle)
  // SECURITY: Simplified pattern - just check if starts with SQL keyword
  const trimmedMessage = message.trimStart();
  const sqlKeywords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
  const startsWithSQL = sqlKeywords.some(kw => 
    trimmedMessage.toUpperCase().startsWith(kw + ' ') || 
    trimmedMessage.toUpperCase().startsWith(kw + '\n')
  );
  
  if (startsWithSQL) {
    return trimmedMessage;
  }
  
  return null;
}

/**
 * Validate SQL against guardrails
 * Returns violation message if invalid, null if valid
 * SECURITY: Uses safe patterns and normalization to prevent bypasses
 */
function validateSQL(sql: string, guardrails: any): string | null {
  // SECURITY: Normalize unicode to prevent bypass via homoglyphs
  // e.g., ＤＥＬＥＴＥ (fullwidth) -> DELETE (ascii)
  const normalizedSQL = sql.normalize('NFKC');
  const sqlUpper = normalizedSQL.toUpperCase();
  
  // SECURITY: Limit SQL length
  if (sql.length > 100000) {
    return 'SQL query too long (max 100KB)';
  }
  
  // Check allowed operations
  if (guardrails.allowedOperations && guardrails.allowedOperations.length > 0) {
    // SECURITY: Simple string matching instead of regex
    const firstWord = sqlUpper.trimStart().split(/[\s\n(]/)[0];
    const allowedOps = guardrails.allowedOperations.map((op: string) => op.toUpperCase());
    
    if (!allowedOps.includes(firstWord)) {
      return `Operation not allowed: ${firstWord}. Allowed: ${guardrails.allowedOperations.join(', ')}`;
    }
  }
  
  // Check allowed tables
  if (guardrails.allowedTables && guardrails.allowedTables.length > 0) {
    // SECURITY: Simple keyword extraction instead of complex regex
    const keywords = ['FROM', 'INTO', 'UPDATE', 'JOIN', 'TABLE'];
    const words = sqlUpper.split(/[\s,();]+/);
    const allowedTablesUpper = guardrails.allowedTables.map((t: string) => t.toUpperCase());
    
    for (let i = 0; i < words.length - 1; i++) {
      if (keywords.includes(words[i])) {
        const potentialTable = words[i + 1];
        // Skip if it's a keyword or looks like a subquery
        if (potentialTable && !keywords.includes(potentialTable) && /^[A-Z_][A-Z0-9_]*$/i.test(potentialTable)) {
          if (!allowedTablesUpper.includes(potentialTable)) {
            return `Table not allowed: ${potentialTable}. Allowed: ${guardrails.allowedTables.join(', ')}`;
          }
        }
      }
    }
  }
  
  // Check for WHERE clause requirement on UPDATE/DELETE
  if (guardrails.requireWhere) {
    const hasUpdate = sqlUpper.includes('UPDATE ');
    const hasDelete = sqlUpper.includes('DELETE ');
    const hasWhere = sqlUpper.includes(' WHERE ');
    
    if ((hasUpdate || hasDelete) && !hasWhere) {
      return 'WHERE clause required for UPDATE/DELETE operations';
    }
  }
  
  // SECURITY: Block dangerous patterns with simple string checks (more reliable than regex)
  const dangerousKeywords = [
    'DROP TABLE', 'DROP DATABASE', 'DROP SCHEMA',
    'TRUNCATE', 'ALTER TABLE', 'CREATE TABLE',
    'GRANT ', 'REVOKE ',
    '; DROP', '; DELETE', '; UPDATE', '; INSERT',  // SQL injection attempts
    '/*', '*/',  // Comment injection
    '--',        // Comment injection
    'EXEC ', 'EXECUTE ', 'XP_',  // Stored procedure execution
    'LOAD_FILE', 'INTO OUTFILE', 'INTO DUMPFILE',  // File operations
  ];
  
  for (const dangerous of dangerousKeywords) {
    if (sqlUpper.includes(dangerous)) {
      return `Blocked: SQL contains dangerous keyword '${dangerous}'`;
    }
  }
  
  // SECURITY: Block tautologies that bypass WHERE
  const tautologyPatterns = [
    /WHERE\s+1\s*=\s*1/i,
    /WHERE\s+TRUE/i,
    /WHERE\s+'[^']*'\s*=\s*'[^']*'/i,
    /OR\s+1\s*=\s*1/i,
    /OR\s+TRUE/i,
  ];
  
  for (const pattern of tautologyPatterns) {
    if (pattern.test(normalizedSQL)) {
      return 'Blocked: SQL contains suspicious tautology pattern';
    }
  }
  
  return null;
}

