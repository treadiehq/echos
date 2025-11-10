// Example: Using @echoshq/runtime npm package
import { EchosRuntime, loadWorkflow, builtInAgents } from '@echoshq/runtime';
import 'dotenv/config';

// Make sure you have:
// 1. Echos platform running (npm run start in the echos repo)
// 2. ECHOS_API_KEY in your .env file
// 3. OPENAI_API_KEY or ANTHROPIC_API_KEY in your .env

const runtime = new EchosRuntime(
  loadWorkflow('./workflow.yaml'),
  builtInAgents,
  {
    apiKey: process.env.ECHOS_API_KEY,
    apiUrl: process.env.ECHOS_API_URL || 'http://localhost:4000'
  }
);

// Run a task
const result = await runtime.run({
  task: 'Tell me a programming joke about TypeScript',
  memory: {}
});

console.log('\n✅ Result:', result);
console.log('\nView trace at: http://localhost:3000');

