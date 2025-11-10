export type AgentName = string;

export interface AgentContext {
  taskId: string;
  workflow: WorkflowConfig;
  memory: Record<string, unknown>;  // filtered view per memoryPolicy.readFrom
  log: (msg: string, data?: unknown) => void;
  putMemory: (namespace: string, kv: Record<string, unknown>) => void; // writes to namespace
  config?: Record<string, unknown>;
  metadata?: TraceMetadata;
}

export interface AgentInput {
  message: string;
  payload?: Record<string, unknown>;
}

export interface AgentResult {
  ok: boolean;
  message: string;
  payload?: Record<string, unknown>;
  // For orchestrator: where to go next (optional terminates if absent)
  next?: AgentName;
  // Performance and metadata
  metadata?: StepMetadata;
  cost?: number;  // optional abstract cost reported by agent step
}

export interface Agent {
  name: AgentName;
  kind: "orchestrator" | "worker";
  handle(ctx: AgentContext, input: AgentInput): Promise<AgentResult>;
}

export interface AgentGuardrails {
  maxCostPerInvocation?: number;  // max cost per single agent call
  // DB Agent specific
  allowedOperations?: string[];   // e.g., ["SELECT", "INSERT", "UPDATE"]
  allowedTables?: string[];       // table whitelist
  requireWhere?: boolean;         // require WHERE clause for UPDATE/DELETE
  // API Agent specific
  allowedDomains?: string[];      // domain whitelist
  allowedMethods?: string[];      // HTTP methods whitelist
  blockPrivateIPs?: boolean;      // prevent SSRF attacks
  // Code Agent specific
  allowExecution?: boolean;       // enable/disable code execution
  maxExecutionTime?: number;      // max execution time in ms
}

export interface AgentPolicy {
  retries?: { count?: number; backoffMs?: number };
  fallback?: AgentName;
  memoryPolicy?: {
    readFrom?: string[];  // namespaces the agent can read
    writeTo?: string;     // default namespace to write to
  };
  guardrails?: AgentGuardrails;  // production safety controls
}

export interface WorkflowConfig {
  name?: string; // Optional workflow name (used for tracking/grouping)
  agents: {
    name: AgentName;
    type: "orchestrator" | "worker";
    maxLoops?: number;
    policy?: AgentPolicy;
  }[];
  routes: Record<
    AgentName,
    {
      canCall: AgentName[];
    }
  >;
  limits?: {
    defaultMaxLoops?: number;
    maxDurationMs?: number;
    maxCost?: number; // abstract units
  };
  memory?: Record<string, Record<string, unknown>>; // pre-seeded memory namespaces
}

// Enhanced trace metadata
export interface TraceMetadata {
  totalDuration?: number;
  totalCost?: number;
  totalTokens?: number;
  llmCalls?: number;
  dbQueries?: number;
  apiCalls?: number;
}

export interface StepMetadata {
  duration?: number;
  tokens?: {
    prompt?: number;
    completion?: number;
    total?: number;
  };
  cost?: number;
  model?: string;
  provider?: string;
  cached?: boolean;
  retries?: number;
  error?: string;
}

