import type { Agent, AgentContext, AgentInput, AgentResult } from "../types";
import { createLLMClient, type LLMMessage } from "../lib/llm";
import { loadConfig } from "../config";

/**
 * Data Analysis Agent:
 * - Uses LLM to analyze, summarize, and generate insights from data
 * - Handles statistical analysis, trend identification, and reporting
 * - Tracks LLM costs and performance metrics
 */
export const data_agent: Agent = {
  name: "data_agent",
  kind: "worker",
  async handle(ctx: AgentContext, input: AgentInput): Promise<AgentResult> {
    ctx.log("data_agent received", input);
    
    try {
      const config = ctx.config ? ctx.config as ReturnType<typeof loadConfig> : loadConfig();
      
      // Check if LLM is configured
      if (!config.openaiApiKey && !config.anthropicApiKey) {
        ctx.log("No LLM API key configured, returning simple summary");
        const summary = `Summary of: ${input.message}`;
        return {
          ok: true,
          message: "Generated basic summary (no LLM configured)",
          payload: { summary },
          cost: 0.25  // abstract cost when using fallback
        };
      }

      const llm = createLLMClient(config);

      // Build analysis prompt
      const systemPrompt = `You are an expert data analyst. Your role is to:
- Analyze data and identify patterns, trends, and insights
- Create clear, actionable summaries and reports
- Provide statistical context when relevant
- Suggest next steps or recommendations

Be concise but thorough. Format your response in a structured way.`;

      // Check if there's data in the payload to analyze
      const hasData = input.payload && Object.keys(input.payload).length > 0;
      const dataContext = hasData 
        ? `\n\nData provided:\n${JSON.stringify(input.payload, null, 2)}`
        : '';

      const messages: LLMMessage[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: `${input.message}${dataContext}` }
      ];

      const response = await llm.chat(messages, { 
        temperature: 0.5, 
        maxTokens: 1500 
      });

      ctx.log("data_agent completed analysis", { 
        summaryLength: response.content.length,
        model: response.metadata.model,
        cost: response.metadata.cost
      });

      return {
        ok: true,
        message: "Generated AI-powered analysis",
        payload: { 
          summary: response.content,
          hasSourceData: hasData,
          insights: extractInsights(response.content)
        },
        metadata: response.metadata,
        cost: response.metadata.cost
      };
    } catch (error) {
      ctx.log("data_agent error", { error: error instanceof Error ? error.message : String(error) });
      return {
        ok: false,
        message: `Analysis error: ${error instanceof Error ? error.message : String(error)}`,
        payload: { error: String(error) }
      };
    }
  }
};

/**
 * Extract key insights from the analysis text
 */
function extractInsights(text: string): string[] {
  const insights: string[] = [];
  
  // Look for bullet points or numbered lists
  const bulletPoints = text.match(/[•\-\*]\s*(.+)/g);
  if (bulletPoints) {
    insights.push(...bulletPoints.map(p => p.replace(/^[•\-\*]\s*/, '').trim()));
  }
  
  // Look for numbered insights
  const numbered = text.match(/\d+\.\s*(.+)/g);
  if (numbered) {
    insights.push(...numbered.map(p => p.replace(/^\d+\.\s*/, '').trim()));
  }
  
  // If no structured insights found, return first few sentences
  if (insights.length === 0) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    insights.push(...sentences.slice(0, 3).map(s => s.trim()));
  }
  
  return insights.slice(0, 5); // Max 5 insights
}

