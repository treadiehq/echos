import { orchestrator } from "./orchestrator.js";
import { db_agent } from "./db_agent.js";
import { data_agent } from "./data_agent.js";
import { search_agent } from "./search_agent.js";
import { api_agent } from "./api_agent.js";
import { code_agent } from "./code_agent.js";
import type { Agent } from "../types.js";

export const builtInAgents: Agent[] = [
  orchestrator,
  db_agent,
  data_agent,
  search_agent,
  api_agent,
  code_agent
];

export function mapAgents(agents: Agent[]): Record<string, Agent> {
  return Object.fromEntries(agents.map(a => [a.name, a]));
}

