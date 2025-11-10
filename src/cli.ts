#!/usr/bin/env node

import 'dotenv/config';
import { loadWorkflow } from "./lib/config.js";
import { EchosRuntime } from "./runtime.js";
import { builtInAgents } from "./agents/index.js";

async function main() {
  const task = process.argv.slice(2).join(" ").trim();
  if (!task) {
    console.error("Usage: echos \"<task description>\"");
    console.error("Example: echos \"Analyze customer sentiment from database\"");
    process.exit(1);
  }

  const apiKey = process.env.ECHOS_API_KEY;
  if (!apiKey) {
    console.error("❌ ECHOS_API_KEY environment variable is required");
    console.error("   Sign up at https://echos.ai to get your API key");
    console.error("   Then set: export ECHOS_API_KEY=ek_your_key_here");
    process.exit(1);
  }

  const wf = loadWorkflow("workflow.yaml");
  const rt = new EchosRuntime(wf, builtInAgents, { apiKey });

  console.log("🔐 Validating API key...");
  
  const res = await rt.run({ task, memory: {} });
  console.log("\n--- RESULT ---");
  console.log(JSON.stringify(res, null, 2));
  console.log(`\n✅ Trace logged to your organization (${res.orgId})`);
  console.log(`   View at: http://localhost:3000/traces/${res.taskId}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

