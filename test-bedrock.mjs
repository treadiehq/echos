#!/usr/bin/env node

/**
 * Test script to verify AWS Bedrock integration with Echos
 * 
 * Prerequisites:
 * 1. AWS credentials configured (IAM role, env vars, or AWS CLI)
 * 2. Bedrock access enabled in your AWS account
 * 3. Model access granted (e.g., Claude 3 Sonnet)
 */

import { loadConfig } from './dist/config.js';
import { createLLMClient } from './dist/lib/llm.js';

console.log('🧪 Testing AWS Bedrock Integration\n');
console.log('━'.repeat(60));

// Test 1: Check environment configuration
console.log('\n📋 Step 1: Checking Environment Variables\n');

const requiredEnvVars = {
  'LLM_PROVIDER': process.env.LLM_PROVIDER,
  'BEDROCK_REGION': process.env.BEDROCK_REGION,
  'BEDROCK_MODEL': process.env.BEDROCK_MODEL,
};

const optionalEnvVars = {
  'AWS_ACCESS_KEY_ID': process.env.AWS_ACCESS_KEY_ID ? '✓ Set' : '✗ Not set (will use IAM role)',
  'AWS_SECRET_ACCESS_KEY': process.env.AWS_SECRET_ACCESS_KEY ? '✓ Set' : '✗ Not set (will use IAM role)',
};

console.log('Required:');
for (const [key, value] of Object.entries(requiredEnvVars)) {
  const status = value ? '✅' : '❌';
  console.log(`  ${status} ${key}: ${value || 'NOT SET'}`);
}

console.log('\nOptional (for explicit credentials):');
for (const [key, value] of Object.entries(optionalEnvVars)) {
  console.log(`  ${value.includes('✓') ? '✅' : '⚠️ '} ${key}: ${value}`);
}

if (process.env.LLM_PROVIDER !== 'bedrock') {
  console.error('\n❌ Error: LLM_PROVIDER must be set to "bedrock"');
  console.log('\n💡 Set it with: export LLM_PROVIDER=bedrock');
  process.exit(1);
}

// Test 2: Load configuration
console.log('\n━'.repeat(60));
console.log('\n📋 Step 2: Loading Configuration\n');

let config;
try {
  config = loadConfig();
  console.log('✅ Configuration loaded successfully');
  console.log(`   Provider: ${config.llmProvider}`);
  console.log(`   Region: ${config.bedrockRegion}`);
  console.log(`   Model: ${config.bedrockModel}`);
} catch (error) {
  console.error('❌ Failed to load configuration:', error.message);
  process.exit(1);
}

// Test 3: Create LLM client
console.log('\n━'.repeat(60));
console.log('\n📋 Step 3: Creating Bedrock Client\n');

let llmClient;
try {
  llmClient = createLLMClient(config);
  console.log('✅ Bedrock client created successfully');
} catch (error) {
  console.error('❌ Failed to create Bedrock client:', error.message);
  console.log('\n💡 Troubleshooting:');
  console.log('   1. Verify AWS credentials are configured');
  console.log('   2. Check Bedrock is available in your region');
  console.log('   3. Ensure model access is granted in AWS console');
  process.exit(1);
}

// Test 4: Make a test call to Bedrock
console.log('\n━'.repeat(60));
console.log('\n📋 Step 4: Testing Bedrock API Call\n');

console.log('Sending test message to Bedrock...');
const startTime = Date.now();

try {
  const response = await llmClient.chat([
    {
      role: 'user',
      content: 'Respond with a short message confirming you are Claude running on AWS Bedrock. Keep it under 50 words.'
    }
  ], {
    temperature: 0.7,
    maxTokens: 100
  });

  const duration = Date.now() - startTime;

  console.log('\n✅ Bedrock API call successful!\n');
  console.log('Response from Bedrock:');
  console.log('─'.repeat(60));
  console.log(response.content);
  console.log('─'.repeat(60));
  
  console.log('\n📊 Metadata:');
  console.log(`   Duration: ${duration}ms`);
  console.log(`   Provider: ${response.metadata.provider}`);
  console.log(`   Model: ${response.metadata.model}`);
  console.log(`   Tokens (prompt): ${response.metadata.tokens?.prompt || 'N/A'}`);
  console.log(`   Tokens (completion): ${response.metadata.tokens?.completion || 'N/A'}`);
  console.log(`   Tokens (total): ${response.metadata.tokens?.total || 'N/A'}`);
  console.log(`   Estimated cost: $${response.metadata.cost?.toFixed(6) || '0.000000'}`);

  console.log('\n━'.repeat(60));
  console.log('\n🎉 All Tests Passed! Bedrock Integration is Working!\n');
  console.log('Next steps:');
  console.log('  1. Run your workflows: npx echos "your task"');
  console.log('  2. Try the Bedrock example: cp examples/aws-bedrock.yaml workflow.yaml');
  console.log('  3. Check traces at: http://localhost:3000\n');

} catch (error) {
  console.error('\n❌ Bedrock API call failed:', error.message);
  console.log('\n💡 Common Issues:\n');
  
  if (error.message.includes('AccessDenied')) {
    console.log('   • IAM permissions missing. Required:');
    console.log('     - bedrock:InvokeModel');
    console.log('     - bedrock:InvokeModelWithResponseStream');
  } else if (error.message.includes('ValidationException')) {
    console.log('   • Model not available in your region or model ID incorrect');
    console.log('   • Check model access in AWS Bedrock console');
  } else if (error.message.includes('UnrecognizedClientException')) {
    console.log('   • AWS credentials invalid or expired');
    console.log('   • Run: aws configure (if using AWS CLI)');
  } else if (error.message.includes('ResourceNotFoundException')) {
    console.log('   • Model not found or access not granted');
    console.log('   • Go to AWS Bedrock console → Model access → Request access');
  } else {
    console.log('   • Check AWS credentials are properly configured');
    console.log('   • Verify Bedrock is enabled in your AWS region');
    console.log('   • Ensure model access is granted for: ' + config.bedrockModel);
  }
  
  console.log('\n📚 Resources:');
  console.log('   • AWS Bedrock Setup: https://docs.aws.amazon.com/bedrock/');
  console.log('   • Model Access: https://console.aws.amazon.com/bedrock/home#/modelaccess');
  console.log('   • IAM Policies: See examples/aws-bedrock.yaml for policy template\n');
  
  process.exit(1);
}

