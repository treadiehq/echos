import type { Agent, AgentContext, AgentInput, AgentResult } from "../types.js";
import { loadConfig } from "../config.js";

/**
 * Search Agent:
 * - Performs web searches using Serper or Brave API
 * - Extracts and formats search results
 * - Tracks API call metrics
 */
export const search_agent: Agent = {
  name: "search_agent",
  kind: "worker",
  async handle(ctx: AgentContext, input: AgentInput): Promise<AgentResult> {
    ctx.log("search_agent received", input);
    
    try {
      const config = ctx.config ? ctx.config as ReturnType<typeof loadConfig> : loadConfig();
      const startTime = Date.now();

      // Extract search query
      const query = input.message.replace(/^(search|find|lookup|google)\s+/i, "").trim();
      
      if (!query) {
        return {
          ok: false,
          message: "❌ No search query provided. Try: 'Search for AI agent frameworks' or 'Find news about multi-agent systems'",
          payload: { 
            error: "NO_QUERY",
            suggestion: "Include 'search', 'find', or 'lookup' in your message",
            examples: [
              "Search for the latest AI news",
              "Find information about multi-agent systems",
              "Lookup competitive pricing for SaaS products"
            ]
          }
        };
      }

      let results;
      let provider = "none";

      if (config.serperApiKey) {
        provider = "serper";
        results = await searchWithSerper(query, config.serperApiKey);
      } else if (config.braveApiKey) {
        provider = "brave";
        results = await searchWithBrave(query, config.braveApiKey);
      } else {
        // Mock results if no API key configured
        ctx.log("No search API configured, returning mock results");
        const duration = Date.now() - startTime;
        return {
          ok: true,
          message: "⚠️  Using mock search results (configure SERPER_API_KEY or BRAVE_API_KEY for real searches)",
          payload: {
            query,
            results: [
              { title: "Mock Result 1", snippet: "This is a mock search result. Add SERPER_API_KEY to .env for real searches.", url: "https://example.com/1" },
              { title: "Mock Result 2", snippet: "Get your free Serper API key at https://serper.dev", url: "https://example.com/2" }
            ],
            warning: "NO_API_KEY_CONFIGURED",
            setup_instructions: {
              serper: "Get free key at https://serper.dev (50k searches/month free)",
              brave: "Get key at https://brave.com/search/api",
              config: "Add to .env: SERPER_API_KEY=your-key-here"
            }
          },
          metadata: { duration, provider: "mock" },
          cost: 0.1
        };
      }

      const duration = Date.now() - startTime;
      ctx.log("search_agent completed", { query, resultCount: results.length, duration });

      return {
        ok: true,
        message: `Found ${results.length} search results for: ${query}`,
        payload: { query, results },
        metadata: { duration, provider },
        cost: 0.02  // cost per search API call (Serper/Brave)
      };
    } catch (error) {
      ctx.log("search_agent error", { error: error instanceof Error ? error.message : String(error) });
      return {
        ok: false,
        message: `Search error: ${error instanceof Error ? error.message : String(error)}`,
        payload: { error: String(error) }
      };
    }
  }
};

async function searchWithSerper(query: string, apiKey: string): Promise<any[]> {
  const fetch = (await import("node-fetch")).default;
  
  try {
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json"
    },
      body: JSON.stringify({ q: query, num: 5 }),
      signal: AbortSignal.timeout(10000) // 10 second timeout
  });

  if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Serper API error (${response.status}): ${response.statusText} - ${errorText}`);
  }

  const data = await response.json() as any;
    
    if (!data || !data.organic) {
      throw new Error("Invalid response from Serper API");
    }
    
  return (data.organic || []).map((r: any) => ({
    title: r.title,
    snippet: r.snippet,
    url: r.link
  }));
  } catch (error) {
    if ((error as any).name === 'AbortError') {
      throw new Error("Serper API request timeout (10s)");
    }
    throw error;
  }
}

async function searchWithBrave(query: string, apiKey: string): Promise<any[]> {
  const fetch = (await import("node-fetch")).default;
  
  try {
    const response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`,
      {
    headers: {
      "Accept": "application/json",
      "X-Subscription-Token": apiKey
        },
        signal: AbortSignal.timeout(10000) // 10 second timeout
    }
    );

  if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Brave API error (${response.status}): ${response.statusText} - ${errorText}`);
  }

  const data = await response.json() as any;
    
    if (!data || !data.web) {
      throw new Error("Invalid response from Brave API");
    }
    
    return (data.web.results || []).map((r: any) => ({
    title: r.title,
    snippet: r.description,
    url: r.url
  }));
  } catch (error) {
    if ((error as any).name === 'AbortError') {
      throw new Error("Brave API request timeout (10s)");
    }
    throw error;
  }
}

