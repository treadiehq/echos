import type { Agent, AgentContext, AgentInput, AgentResult } from "../types.js";
import { loadConfig } from "../config.js";
import { createLLMClient, type LLMMessage } from "../lib/llm.js";

/**
 * Code Agent:
 * - Generates code using LLMs
 * - Can execute safe JavaScript/TypeScript code (when enabled)
 * - Tracks execution metrics
 */
export const code_agent: Agent = {
  name: "code_agent",
  kind: "worker",
  async handle(ctx: AgentContext, input: AgentInput): Promise<AgentResult> {
    ctx.log("code_agent received", input);
    
    try {
      const config = ctx.config ? ctx.config as ReturnType<typeof loadConfig> : loadConfig();
      const startTime = Date.now();

      // Check if this is a code generation or execution request
      const isExecutionRequest = input.message.toLowerCase().includes("execute") || 
                                 input.message.toLowerCase().includes("run") ||
                                 input.payload?.execute === true;

      if (isExecutionRequest && !config.enableCodeExecution) {
        return {
          ok: false,
          message: "Code execution is disabled. Set ENABLE_CODE_EXECUTION=true to enable.",
          payload: { error: "Code execution disabled" }
        };
      }

      // Check for LLM availability for code generation
      if (!config.openaiApiKey && !config.anthropicApiKey) {
        return {
          ok: false,
          message: "❌ No LLM API key configured for code generation",
          payload: { 
            error: "NO_LLM_API_KEY",
            suggestion: "Add API key to .env file",
            setup: {
              openai: {
                key: "OPENAI_API_KEY=sk-your-key",
                get_key: "https://platform.openai.com/api-keys"
              },
              anthropic: {
                key: "ANTHROPIC_API_KEY=sk-ant-your-key",
                get_key: "https://console.anthropic.com/"
              }
            }
          }
        };
      }

      const llm = createLLMClient(config);

      // Generate code using LLM
      const systemPrompt = `You are an expert programmer. Generate clean, well-documented code based on the user's request. 
Include comments and follow best practices. Only return the code, no explanations.`;

      const messages: LLMMessage[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: input.message }
      ];

      const response = await llm.chat(messages, { temperature: 0.2, maxTokens: 2000 });
      const generatedCode = extractCode(response.content);

      ctx.log("code_agent generated code", { 
        codeLength: generatedCode.length,
        model: response.metadata.model 
      });

      let executionResult = null;
      if (isExecutionRequest && config.enableCodeExecution) {
        try {
          executionResult = await executeCode(generatedCode, config.codeExecutionTimeout);
          ctx.log("code_agent executed code", { success: true });
        } catch (execError) {
          ctx.log("code_agent execution failed", { error: String(execError) });
          executionResult = { error: String(execError) };
        }
      }

      const duration = Date.now() - startTime;

      return {
        ok: true,
        message: `Code generated successfully${executionResult ? " and executed" : ""}`,
        payload: {
          code: generatedCode,
          language: detectLanguage(generatedCode),
          executionResult
        },
        metadata: {
          ...response.metadata,
          duration
        },
        cost: response.metadata.cost // use real LLM cost
      };
    } catch (error) {
      ctx.log("code_agent error", { error: error instanceof Error ? error.message : String(error) });
      return {
        ok: false,
        message: `Code generation error: ${error instanceof Error ? error.message : String(error)}`,
        payload: { error: String(error) }
      };
    }
  }
};

function extractCode(content: string): string {
  // Try to extract code from markdown code blocks
  const codeBlockMatch = content.match(/```[\w]*\n([\s\S]+?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  return content.trim();
}

function detectLanguage(code: string): string {
  if (code.includes("function") || code.includes("const") || code.includes("let")) return "javascript";
  if (code.includes("def ") || code.includes("import ")) return "python";
  if (code.includes("fn ") || code.includes("impl ")) return "rust";
  return "unknown";
}

async function executeCode(code: string, timeout: number): Promise<any> {
  // ⚠️ CRITICAL SECURITY WARNING ⚠️
  // This function uses eval() which is EXTREMELY DANGEROUS and should NEVER be used in production!
  // 
  // Why this is dangerous:
  // - Can access all Node.js APIs (file system, network, process)
  // - Can execute arbitrary system commands
  // - Can steal environment variables (API keys, secrets)
  // - No memory limits or resource controls
  //
  // For production, use one of these alternatives:
  // 1. vm2 or isolated-vm (sandboxed Node.js VM)
  // 2. Docker containers with limited resources
  // 3. WebAssembly sandboxes
  // 4. Cloud Functions (AWS Lambda, Google Cloud Run)
  // 5. Third-party code execution APIs (Judge0, Piston)
  //
  // This implementation is ONLY for development/demo purposes with trusted code.
  
  throw new Error(
    "Code execution is disabled for security. " +
    "To enable: Set ENABLE_CODE_EXECUTION=true in .env AND implement proper sandboxing. " +
    "See code_agent.ts for security guidelines."
  );
  
  // Original dangerous implementation (commented out):
  // return new Promise((resolve, reject) => {
  //   const timeoutId = setTimeout(() => {
  //     reject(new Error("Code execution timeout"));
  //   }, timeout);
  //
  //   try {
  //     const result = eval(code);
  //     clearTimeout(timeoutId);
  //     resolve(result);
  //   } catch (error) {
  //     clearTimeout(timeoutId);
  //     reject(error);
  //   }
  // });
}

