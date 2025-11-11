#!/usr/bin/env node

/**
 * Quick Time-Travel Debugging Demo
 * 
 * This creates a failing trace you can debug in the UI
 */

import 'dotenv/config';
import { EchosRuntime } from '../dist/index.js';

console.log('🎯 Time-Travel Debugging Demo\n');

if (!process.env.ECHOS_API_KEY) {
  console.log('⚠️  No API key found. Running with defaults...\n');
  console.log('To test with your account:');
  console.log('  1. Start Echos: npm run start');
  console.log('  2. Sign up: http://localhost:3000/signup');
  console.log('  3. Get your API key from Settings');
  console.log('  4. Run: ECHOS_API_KEY=your-key node examples/demo-time-travel.mjs\n');
}

console.log('Creating a failing workflow run...\n');

try {
  const runtime = new EchosRuntime({
    apiKey: process.env.ECHOS_API_KEY || 'demo-key',
    apiUrl: process.env.ECHOS_API_URL || 'http://localhost:4000',
    workflow: './workflow.yaml'
  });

  // This will fail because we're not providing a URL for the API agent
  const result = await runtime.run({
    task: 'Make an API call to fetch GitHub data',
    memory: {} // Missing URL - will cause failure!
  });

  console.log('📊 Result:');
  console.log(`   Status: ${result.status} ${result.status === 'error' ? '❌' : '✅'}`);
  console.log(`   Trace ID: ${result.taskId}`);
  console.log(`   Cost: $${result.totals.cost.toFixed(4)}`);
  
  if (result.error) {
    console.log(`   Error: ${result.error}`);
  }

  console.log('\n🎯 Now open Time-Travel Debug:\n');
  console.log(`   1. Open: http://localhost:3000/?trace=${result.taskId}`);
  console.log('   2. Click "Time Travel Debug" button');
  console.log('   3. Edit the config (e.g., increase retry count)');
  console.log('   4. Click "Test This Fix"');
  console.log('   5. See the comparison: Original ❌ → Fixed ✅');
  console.log('   6. Click "Deploy This Fix" to save\n');
  
  console.log('✅ Demo trace created! Check your dashboard.\n');

} catch (error) {
  console.error('\n❌ Error:', error.message);
  console.error('\nMake sure:');
  console.error('   • Echos is running: npm run start');
  console.error('   • Server is at http://localhost:4000');
  console.error('   • Database is connected\n');
}

