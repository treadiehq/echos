import { EchosRuntime, loadWorkflow, builtInAgents } from './src/index';

async function main() {
  // API key is required - get yours at http://localhost:3000
  const apiKey = process.env.ECHOS_API_KEY;
  
  if (!apiKey) {
    console.error('❌ ECHOS_API_KEY is required');
    console.error('   1. Start the server: npm start');
    console.error('   2. Login at http://localhost:3000/login');
    console.error('   3. Create organization and generate API key');
    console.error('   4. Set: export ECHOS_API_KEY=ek_your_key_here');
    process.exit(1);
  }

  // Load your workflow configuration
  const workflow = loadWorkflow('./workflow.yaml');
  
  // Initialize runtime with API key
  const runtime = new EchosRuntime(workflow, builtInAgents, {
    apiKey,
    apiUrl: 'http://localhost:4000' // Optional: defaults to localhost:4000
  });

  console.log('🔐 Authenticating with API key...');
  
  // Run your task
  const result = await runtime.run({
    task: "Analyze customer sentiment from the database",
    memory: { timeframe: '30days' }
  });

  console.log('\n✅ Task completed!');
  console.log('Status:', result.status);
  console.log('Org ID:', result.orgId);
  console.log('Task ID:', result.taskId);
  console.log('Total Cost:', result.totals.cost);
  console.log('\n📊 View trace at: http://localhost:3000/traces/' + result.taskId);
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
