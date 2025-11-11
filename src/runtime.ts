import { randomUUID } from "node:crypto";
import type { Agent, AgentInput, AgentName, WorkflowConfig, AgentPolicy } from "./types.js";
import { TraceStore } from "./lib/trace.js";
import { mapAgents, builtInAgents } from "./agents/index.js";
import { loadWorkflow } from "./lib/config.js";

export interface RunOptions {
  task: string;
  memory?: Record<string, unknown>;
  workflow: WorkflowConfig;
  agents?: Agent[]; // allow app to register custom agents
}

type Mem = Record<string, Record<string, unknown>>; // { namespace: { k: v } }

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function readView(mem: Mem, readFrom?: string[]): Record<string, unknown> {
  if (!readFrom || !readFrom.length) return {};
  const out: Record<string, unknown> = {};
  for (const ns of readFrom) {
    const kv = mem[ns] || {};
    for (const [k, v] of Object.entries(kv)) out[`${ns}.${k}`] = v;
  }
  return out;
}

export interface EchosConfig {
  apiKey?: string;
  apiUrl?: string;
  workflow?: string; // Path to workflow YAML file
  workflowConfig?: WorkflowConfig; // Direct workflow config object (takes precedence over workflow path)
  workflowName?: string; // Optional workflow name for tracking (overridden by workflow config)
  agents?: Agent[]; // Custom agents to register
}

export class EchosRuntime {
  private cfg: WorkflowConfig;
  private agentMap: Record<string, Agent>;
  private apiKey: string;
  private apiUrl: string;
  private orgId?: string;
  private workflowName: string;

  constructor(config: EchosConfig = {}) {
    // Get API key from config or environment
    const apiKey = config.apiKey || process.env.ECHOS_API_KEY;
    if (!apiKey) {
      throw new Error('API key is required. Set ECHOS_API_KEY environment variable or pass apiKey in config. Sign up at https://echos.ai to get your API key');
    }
    
    this.apiKey = apiKey;
    this.apiUrl = config.apiUrl || process.env.ECHOS_API_URL || 'http://localhost:4000';
    
    // Priority: direct config > file path > default
    if (config.workflowConfig) {
      // Use the directly provided workflow config
      this.cfg = config.workflowConfig;
    } else {
      // Load workflow from file or use default
      const workflowPath = config.workflow || 'workflow.yaml';
      try {
        this.cfg = loadWorkflow(workflowPath);
      } catch (err) {
        // If workflow file not found, use a minimal default configuration
        this.cfg = {
          name: config.workflowName || 'default-workflow',
          agents: [
            { name: 'orchestrator', type: 'orchestrator' }
          ],
          routes: {
            orchestrator: { canCall: [] }
          }
        };
      }
    }
    
    // Use built-in agents by default, but allow custom agents to be added
    const agents = [...builtInAgents, ...(config.agents || [])];
    this.agentMap = mapAgents(agents);
    
    // Priority: workflow.yaml name > constructor workflowName > default
    this.workflowName = this.cfg.name || config.workflowName || 'embedded-workflow';
  }

  async validateApiKey(): Promise<void> {
    try {
      const response = await fetch(`${this.apiUrl}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Invalid API key. Status: ${response.status}`);
      }

      const data = await response.json() as { orgId: string };
      this.orgId = data.orgId;
      
      if (!this.orgId) {
        throw new Error('API key is valid but no organization found. Please create an organization first.');
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`API key validation failed: ${error.message}`);
      }
      throw new Error('API key validation failed: Unable to connect to Echos API');
    }
  }

  async run(taskOrOpts: string | Omit<RunOptions, "workflow" | "agents">) {
    // Support both string and object input
    const opts = typeof taskOrOpts === 'string' 
      ? { task: taskOrOpts } 
      : taskOrOpts;

    // Validate API key before running
    if (!this.orgId) {
      await this.validateApiKey();
    }

    const taskId = randomUUID();
    const ceilings = { maxDurationMs: this.cfg.limits?.maxDurationMs, maxCost: this.cfg.limits?.maxCost };
    const mem: Mem = { ...(this.cfg.memory || {}) };
    const trace = new TraceStore(
      taskId, 
      ceilings, 
      Object.keys(mem),
      this.cfg, // Store workflow config for time-travel debugging
      opts.task, // Store initial task
      opts.memory // Store initial memory
    );

    const defaultMax = this.cfg.limits?.defaultMaxLoops ?? 3;
    const loopState: Record<AgentName, number> = {};
    let totalCost = 0;
    const startAt = Date.now();

    const log = (msg: string, data?: unknown) => {
      if (process.env.ECHOS_LOGS !== "0") console.log(`[${taskId}] ${msg}`, data ?? "");
    };

    const putMemory = (namespace: string, kv: Record<string, unknown>) => {
      mem[namespace] = mem[namespace] || {};
      Object.assign(mem[namespace], kv);
    };

    const start = "orchestrator";
    let current: AgentName | undefined = start;
    let input: AgentInput = { message: opts.task, payload: opts.memory ?? {} };
    let status: "ok" | "error" | "stopped" = "ok";
    let error: string | undefined;

    try {
      while (current) {
        const agent = this.agentMap[current];
        if (!agent) throw new Error(`Agent not found: ${current}`);

        const conf = this.cfg.agents.find(a => a.name === current);
        const max = conf?.maxLoops ?? defaultMax;
        loopState[current] = (loopState[current] ?? 0) + 1;
        const loop = loopState[current];

        if (loop > max) {
          status = "stopped"; error = `Loop limit exceeded for ${current} (max ${max})`; log(error);
          break;
        }

        // ceilings check
        if (ceilings.maxDurationMs && Date.now() - startAt > ceilings.maxDurationMs) {
          status = "stopped"; error = `Duration ceiling exceeded (${ceilings.maxDurationMs}ms)`; log(error);
          break;
        }

        if (ceilings.maxCost && totalCost > ceilings.maxCost) {
          status = "stopped"; error = `Cost ceiling exceeded (${ceilings.maxCost})`; log(error);
          break;
        }

        const policy: AgentPolicy | undefined = conf?.policy;
        const view = readView(mem, policy?.memoryPolicy?.readFrom);
        const ctx = { taskId, workflow: this.cfg, memory: view, log, putMemory };

        // retry loop
        const maxAttempts = Math.max(1, policy?.retries?.count ?? 1);
        const backoff = Math.max(0, policy?.retries?.backoffMs ?? 0);
        let attempt = 0;
        let success = false;
        let output: any = null;
        let lastErr: string | undefined;

        while (attempt < maxAttempts && !success) {
          attempt++;
          try {
            output = await agent.handle(ctx, input);
            if (!output || output.ok === false) {
              lastErr = output?.message || `Agent ${current} returned ok=false`;
              if (attempt < maxAttempts) await sleep(backoff);
            } else {
              success = true;
            }
          } catch (e: any) {
            lastErr = e?.message ?? String(e);
            if (attempt < maxAttempts) await sleep(backoff);
          }

          // record step for each attempt
          const stepCost = typeof output?.cost === "number" ? output.cost : 0;
          totalCost += stepCost;
          
          // Check per-agent cost ceiling (guardrail)
          const agentCostCeiling = policy?.guardrails?.maxCostPerInvocation;
          if (agentCostCeiling && stepCost > agentCostCeiling) {
            log(`Agent ${current} exceeded cost ceiling: ${stepCost} > ${agentCostCeiling}`);
            trace.add({
              at: new Date().toISOString(),
              agent: current,
              input,
              output: { 
                ok: false, 
                message: `Agent cost ceiling exceeded: ${stepCost} > ${agentCostCeiling}`,
                payload: { error: "GUARDRAIL_VIOLATION", actualCost: stepCost, ceiling: agentCostCeiling }
              },
              loop,
              attempt
            });
            status = "stopped"; 
            error = `Agent ${current} cost ceiling exceeded: ${stepCost} > ${agentCostCeiling}`;
            break;
          }
          
          trace.add({
            at: new Date().toISOString(),
            agent: current,
            input,
            output: output ?? { ok: false, message: lastErr || "unknown error" },
            loop,
            attempt
          });

          // ceilings after attempt
          if (ceilings.maxDurationMs && Date.now() - startAt > ceilings.maxDurationMs) {
            status = "stopped"; error = `Duration ceiling exceeded (${ceilings.maxDurationMs}ms)`; break;
          }
          if (ceilings.maxCost && totalCost > ceilings.maxCost) {
            status = "stopped"; error = `Cost ceiling exceeded (${ceilings.maxCost})`; break;
          }
        }

        if (!success) {
          // try fallback if configured
          const fb = policy?.fallback;
          if (fb) {
            log(`Attempting fallback ${current} -> ${fb}`);
            // redirect to fallback with same input
            current = fb;
            continue;
          }
          status = "error"; error = lastErr || `Agent ${current} failed`; break;
        }

        // writes to memory (optional): if agent set payload, store under writeTo namespace
        const writeNs = policy?.memoryPolicy?.writeTo;
        if (writeNs && output?.payload && typeof output.payload === "object") {
          putMemory(writeNs, output.payload);
        }

        // Determine next hop
        if (agent.kind === "orchestrator") {
          const allowed = this.cfg.routes?.[current]?.canCall ?? [];
          if (output.next && !allowed.includes(output.next)) {
            throw new Error(`Route not permitted: ${current} -> ${output.next}`);
          }
          current = output.next;
          // Keep original user message for worker agents
          input = { message: input.message, payload: output.payload || input.payload };
        } else {
          // Worker agent completed - route back to orchestrator for next decision
          // unless the worker explicitly set next=undefined or we hit loop limit
          const orchestratorLoops = loopState["orchestrator"] ?? 0;
          const orchestratorMax = this.cfg.agents.find(a => a.name === "orchestrator")?.maxLoops ?? defaultMax;
          
          if (output.next === undefined && orchestratorLoops < orchestratorMax) {
            // Return to orchestrator with worker's result
            current = "orchestrator";
            input = { 
              message: `Previous step completed: ${output.message || "Success"}. Original task: ${opts.task}`,
              payload: output.payload || input.payload 
            };
            log(`Worker ${agent.name} completed, returning to orchestrator`);
          } else {
            // Worker explicitly ended workflow or orchestrator hit loop limit
          current = undefined;
          input = { message: output.message, payload: output.payload };
          }
        }
      }
    } catch (e: any) {
      status = "error"; error = e?.message ?? String(e);
    } finally {
      trace.end(status, error);
      
      // Send trace to API for tracking
      try {
        const response = await fetch(`${this.apiUrl}/traces`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            workflowName: this.workflowName,
            data: trace.get()
          })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.warn(`Failed to save trace (${response.status}):`, errorText);
        }
      } catch (err) {
        // Don't fail the workflow if trace logging fails
        console.warn('Failed to send trace to API:', err);
      }
    }

    return { taskId, status, error, result: input, totals: { cost: totalCost }, orgId: this.orgId };
  }

  /**
   * Time-Travel Debugging: Replay a trace with modified workflow configuration
   * Uses the original task and memory from the trace, but applies new config
   */
  async replay(originalTrace: any, modifiedWorkflowConfig: WorkflowConfig) {
    // Extract original context from trace
    const originalTask = originalTrace.initialTask || 'Unknown task';
    const originalMemory = originalTrace.initialMemory || {};
    
    // Temporarily swap the workflow config
    const originalConfig = this.cfg;
    this.cfg = modifiedWorkflowConfig;
    
    try {
      // Run with original inputs but new config
      const result = await this.run({
        task: originalTask,
        memory: originalMemory
      });
      
      // Restore original config
      this.cfg = originalConfig;
      
      return {
        ...result,
        isReplay: true,
        originalTraceId: originalTrace.taskId
      };
    } catch (error) {
      // Restore original config even on error
      this.cfg = originalConfig;
      throw error;
    }
  }
}

