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
}

export class TraceStore {
  private file: string;
  private trace: Trace;

  constructor(taskId: string, ceilings?: Trace["ceilings"], memoryNamespaces?: string[]) {
    const dir = path.resolve(process.cwd(), "traces");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    this.file = path.join(dir, `${taskId}.json`);
    this.trace = {
      taskId,
      startedAt: formatISO(new Date()),
      steps: [],
      status: "running",
      ceilings,
      totals: { cost: 0, durationMs: 0 },
      memoryNamespaces
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
    this.trace.finishedAt = formatISO(new Date());
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

