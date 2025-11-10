import type { Agent, AgentContext, AgentInput, AgentResult } from "../types";

/**
 * API Agent:
 * - Makes HTTP requests to external APIs
 * - Supports GET, POST, PUT, DELETE methods
 * - Handles authentication headers
 * - Tracks API call metrics
 */
export const api_agent: Agent = {
  name: "api_agent",
  kind: "worker",
  async handle(ctx: AgentContext, input: AgentInput): Promise<AgentResult> {
    ctx.log("api_agent received", input);
    
    try {
      const startTime = Date.now();
      
      // Extract API call details from payload
      const url = input.payload?.url as string;
      const method = (input.payload?.method as string || "GET").toUpperCase();
      const headers = input.payload?.headers as Record<string, string> || {};
      const body = input.payload?.body;

      if (!url) {
        return {
          ok: false,
          message: "❌ No URL provided. API calls need a URL in the payload.",
          payload: { 
            error: "NO_URL",
            suggestion: "Provide URL when calling runtime.run()",
            example: {
              code: `runtime.run({
  task: "Fetch and analyze data",
  memory: { 
    url: "https://api.github.com/repos/vercel/next.js",
    method: "GET"
  }
})`,
              description: "Pass URL via memory.url payload"
            },
            docs: "See examples/api-integration.yaml for details"
          }
        };
      }

      // Get guardrails from workflow config
      const agentConfig = ctx.workflow.agents.find(a => a.name === "api_agent");
      const guardrails = agentConfig?.policy?.guardrails;

      ctx.log("api_agent: Guardrails loaded", { guardrails, url, method });

      // Enforce guardrails
      if (guardrails) {
        // Check allowed domains
        if (guardrails.allowedDomains && guardrails.allowedDomains.length > 0) {
          const parsedUrl = new URL(url);
          const domain = parsedUrl.hostname;
          
          if (!guardrails.allowedDomains.includes(domain)) {
            ctx.log("api_agent blocked: domain not in allowlist", { domain, allowed: guardrails.allowedDomains });
            return {
              ok: false,
              message: `Security: Domain '${domain}' not in allowlist`,
              payload: { 
                error: "GUARDRAIL_VIOLATION", 
                domain,
                allowedDomains: guardrails.allowedDomains,
                suggestion: `Add '${domain}' to workflow.yaml → api_agent → guardrails → allowedDomains`,
                fix: {
                  file: "workflow.yaml",
                  path: "agents[api_agent].policy.guardrails.allowedDomains",
                  action: `Add: - ${domain}`
                }
              }
            };
          }
        }

        // Check allowed HTTP methods
        if (guardrails.allowedMethods && guardrails.allowedMethods.length > 0) {
          if (!guardrails.allowedMethods.includes(method)) {
            ctx.log("api_agent blocked: method not allowed", { method, allowed: guardrails.allowedMethods });
            return {
              ok: false,
              message: `HTTP method not allowed: ${method}. Allowed methods: ${guardrails.allowedMethods.join(', ')}`,
              payload: { 
                error: "GUARDRAIL_VIOLATION", 
                method, 
                allowedMethods: guardrails.allowedMethods 
              }
            };
          }
        }

        // Check for private IPs (SSRF protection)
        if (guardrails.blockPrivateIPs) {
          const parsedUrl = new URL(url);
          const hostname = parsedUrl.hostname;
          
          if (isPrivateIP(hostname)) {
            ctx.log("api_agent blocked: private IP detected (SSRF protection)", { hostname });
            return {
              ok: false,
              message: `Private IP addresses are blocked for security: ${hostname}`,
              payload: { 
                error: "GUARDRAIL_VIOLATION", 
                reason: "SSRF_PROTECTION",
                hostname 
              }
            };
          }
        }
      }

      ctx.log("api_agent making request", { url, method });

      const fetch = (await import("node-fetch")).default;
      
      const fetchOptions: any = {
        method,
        headers: {
          "Content-Type": "application/json",
          ...headers
        },
        signal: AbortSignal.timeout(30000) // 30 second timeout
      };

      if (body && ["POST", "PUT", "PATCH"].includes(method)) {
        fetchOptions.body = typeof body === "string" ? body : JSON.stringify(body);
      }

      let response;
      try {
        response = await fetch(url, fetchOptions);
      } catch (fetchError) {
        if ((fetchError as any).name === 'AbortError') {
          throw new Error("API request timeout (30s)");
        }
        throw fetchError;
      }
      
      const duration = Date.now() - startTime;

      let responseData;
      const contentType = response.headers.get("content-type");
      
      if (contentType?.includes("application/json")) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      ctx.log("api_agent completed", { 
        status: response.status, 
        statusText: response.statusText,
        duration 
      });

      return {
        ok: response.ok,
        message: `API call ${response.ok ? "succeeded" : "failed"}: ${response.status} ${response.statusText}`,
        payload: {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          data: responseData
        },
        metadata: { duration, provider: "http" },
        cost: 0.01  // small cost per external API call
      };
    } catch (error) {
      ctx.log("api_agent error", { error: error instanceof Error ? error.message : String(error) });
      return {
        ok: false,
        message: `API error: ${error instanceof Error ? error.message : String(error)}`,
        payload: { error: String(error) }
      };
    }
  }
};

/**
 * Check if hostname is a private/internal IP (SSRF protection)
 */
function isPrivateIP(hostname: string): boolean {
  // Check for localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return true;
  }
  
  // Check for private IP ranges
  const privateRanges = [
    /^10\./,                    // 10.0.0.0/8
    /^172\.(1[6-9]|2[0-9]|3[01])\./, // 172.16.0.0/12
    /^192\.168\./,              // 192.168.0.0/16
    /^169\.254\./,              // 169.254.0.0/16 (link-local)
    /^127\./,                   // 127.0.0.0/8 (loopback)
    /^0\.0\.0\.0$/,             // 0.0.0.0
    /^::1$/,                    // IPv6 loopback
    /^fe80:/,                   // IPv6 link-local
    /^fc00:/,                   // IPv6 private
  ];
  
  return privateRanges.some(range => range.test(hostname));
}

