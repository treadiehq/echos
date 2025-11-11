import fs from "node:fs";
import path from "node:path";
import { formatISO } from "date-fns";

export interface TraceStep {
  at: string;
  agent: string;
  input: { message: string; payload?: Record<string, unknown> };
  output: { ok: boolean; message: string; payload?: Record<string, unknown>; next?: string; cost?: number };
  loop: number;
  attempt: number; // retry attempt (1..N)
}

export interface Trace {
  taskId: string;
  startedAt: string;
  finishedAt?: string;
  steps: TraceStep[];
  status: "running" | "ok" | "error" | "stopped";
  error?: string;
  ceilings?: { maxDurationMs?: number; maxCost?: number };
  totals?: { cost: number; durationMs: number };
  memoryNamespaces?: string[];
  // Time-travel debugging: Store workflow config and initial context
  workflowConfig?: any; // The workflow configuration used for this run
  initialTask?: string; // The original task/message
  initialMemory?: Record<string, unknown>; // The initial memory/payload
}

export class TraceStore {
  private file: string;
  private trace: Trace;

  constructor(
    taskId: string, 
    ceilings?: Trace["ceilings"], 
    memoryNamespaces?: string[],
    workflowConfig?: any,
    initialTask?: string,
    initialMemory?: Record<string, unknown>
  ) {
    const dir = path.resolve(process.cwd(), "traces");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    this.file = path.join(dir, `${taskId}.json`);
    this.trace = {
      taskId,
      startedAt: new Date().toISOString(), // Use toISOString() for consistent UTC timestamps
      steps: [],
      status: "running",
      ceilings,
      totals: { cost: 0, durationMs: 0 },
      memoryNamespaces,
      workflowConfig,
      initialTask,
      initialMemory
    };
    this.flush();
  }

  add(step: TraceStep) {
    this.trace.steps.push(step);
    if (step.output?.cost) {
      this.trace.totals = this.trace.totals || { cost: 0, durationMs: 0 };
      this.trace.totals.cost += step.output.cost;
    }
    this.flush();
  }

  end(status: Trace["status"], error?: string) {
    this.trace.status = status;
    this.trace.finishedAt = new Date().toISOString(); // Use toISOString() for consistent UTC timestamps
    const dur = new Date(this.trace.finishedAt).getTime() - new Date(this.trace.startedAt).getTime();
    this.trace.totals = this.trace.totals || { cost: 0, durationMs: 0 };
    this.trace.totals.durationMs = dur;
    if (error) this.trace.error = error;
    this.flush();
  }

  get(): Trace {
    return this.trace;
  }

  private flush() {
    fs.writeFileSync(this.file, JSON.stringify(this.trace, null, 2), "utf8");
  }
}

