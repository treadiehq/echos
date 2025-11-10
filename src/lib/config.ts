import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import type { WorkflowConfig } from "../types";

export function loadWorkflow(p = "workflow.yaml"): WorkflowConfig {
  const file = path.resolve(process.cwd(), p);
  if (!fs.existsSync(file)) {
    throw new Error(`workflow.yaml not found at ${file}`);
  }
  const y = fs.readFileSync(file, "utf8");
  const cfg = parse(y) as WorkflowConfig;
  // basic validation
  const names = new Set(cfg.agents.map(a => a.name));
  for (const [from, r] of Object.entries(cfg.routes || {})) {
    if (!names.has(from)) throw new Error(`route references unknown agent: ${from}`);
    for (const to of r.canCall) {
      if (!names.has(to)) throw new Error(`route references unknown agent: ${to}`);
    }
  }
  return cfg;
}

