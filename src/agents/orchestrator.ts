import type { Agent, AgentContext, AgentInput, AgentResult } from "../types";
import { createLLMClient, type LLMMessage } from "../lib/llm";
import { loadConfig } from "../config";

/**
 * LLM-Powered Orchestrator:
 * - Uses GPT-4/Claude to intelligently route tasks to the appropriate agent
 * - Provides reasoning for routing decisions
 * - Tracks performance metrics
 */
export const orchestrator: Agent = {
  name: "orchestrator",
  kind: "orchestrator",
  async handle(ctx: AgentContext, input: AgentInput): Promise<AgentResult> {
    try {
      // Try LLM-based routing first
      const config = ctx.config ? ctx.config as ReturnType<typeof loadConfig> : loadConfig();
      
      // Check if LLM is configured
      if (!config.openaiApiKey && !config.anthropicApiKey) {
        ctx.log("No LLM API key configured, falling back to keyword matching");
        return fallbackRouting(ctx, input);
      }

      const llm = createLLMClient(config);
      
      // Get available agents from workflow
      const availableAgents = ctx.workflow.agents
        .filter(a => a.name !== "orchestrator")
        .map(a => a.name);

      const systemPrompt = `You are an intelligent task router for a multi-agent system.
Your job is to analyze the user's request and decide which agent should handle the NEXT step.

Available agents:
- db_agent: Handles database queries, SQL operations, data retrieval from databases
- search_agent: Handles web searches, finding information online, news articles
- api_agent: Handles HTTP API calls with specific URLs (e.g., "call https://api.github.com/repos")
- data_agent: Handles data analysis, summaries, charts, statistics, sentiment analysis
- code_agent: Handles code generation, execution, and debugging

Rules:
- If the task mentions "database" or "SQL" and no data has been retrieved yet → choose db_agent
- If the task mentions "search" or "news" and no search has been done → choose search_agent
- If the task has a specific URL to call and it hasn't been called → choose api_agent
- If data has been gathered and needs analysis/summary → choose data_agent
- If the task mentions "code" or "generate" → choose code_agent
- If the message says "Previous step completed" and original task is fully done → respond "DONE"
- If unsure what's left to do → respond "DONE"

Respond with ONLY the agent name (e.g., "db_agent") OR "DONE" if the task is complete.`;

      const messages: LLMMessage[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Task: ${input.message}` }
      ];

      const response = await llm.chat(messages, { temperature: 0.3, maxTokens: 50 });
      const next = response.content.trim().toLowerCase();

      // Check if task is complete
      if (next === "done" || next.includes("done") || next === "complete") {
        ctx.log("LLM orchestrator completed task", { 
          model: response.metadata.model,
          cost: response.metadata.cost
        });
        return {
          ok: true,
          message: "Task completed successfully",
          payload: input.payload,
          next: undefined, // This will end the workflow
          metadata: response.metadata,
          cost: response.metadata.cost
        };
      }

      // Validate the agent exists
      if (!availableAgents.includes(next)) {
        ctx.log("LLM suggested unknown agent, using fallback", { suggested: next, available: availableAgents });
        return fallbackRouting(ctx, input);
      }

      ctx.log("LLM orchestrator routed task", { 
        next, 
        reasoning: "AI decision",
        model: response.metadata.model,
        cost: response.metadata.cost
      });

      return {
        ok: true,
        message: `Routing to ${next} (AI decision)`,
        payload: input.payload,
        next,
        metadata: response.metadata,
        cost: response.metadata.cost // use real LLM cost
      };
    } catch (error) {
      // Fallback to keyword matching if LLM fails
      ctx.log("LLM routing failed, using fallback", { error: error instanceof Error ? error.message : String(error) });
      return fallbackRouting(ctx, input);
    }
  }
};

/**
 * Fallback routing using simple keyword matching
 */
function fallbackRouting(ctx: AgentContext, input: AgentInput): AgentResult {
  const text = input.message.toLowerCase();

  let next: string | undefined;
  if (text.includes("sql") || text.includes("db") || text.includes("query") || text.includes("database")) {
    next = "db_agent";
  } else if (text.includes("search") || text.includes("find") || text.includes("lookup") || text.includes("google")) {
    next = "search_agent";
  } else if (text.includes("api") || text.includes("http") || text.includes("fetch") || text.includes("request")) {
    next = "api_agent";
  } else if (text.includes("code") || text.includes("script") || text.includes("program") || text.includes("execute")) {
    next = "code_agent";
  } else if (text.includes("analy") || text.includes("chart") || text.includes("summary") || text.includes("report")) {
    next = "data_agent";
  } else {
    // default route
    next = "data_agent";
  }

  ctx.log("fallback orchestrator routed task", { next });
  return {
    ok: true,
    message: `Routing to ${next} (keyword matching)`,
    payload: input.payload,
    next,
    cost: 0.001 // minimal cost for keyword-based routing
  };
}

