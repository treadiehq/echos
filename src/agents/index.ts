import { orchestrator } from "./orchestrator";
import { db_agent } from "./db_agent";
import { data_agent } from "./data_agent";
import { search_agent } from "./search_agent";
import { api_agent } from "./api_agent";
import { code_agent } from "./code_agent";
import type { Agent } from "../types";

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

