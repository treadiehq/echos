#!/usr/bin/env node

import 'dotenv/config';
import { EchosRuntime } from "./runtime.js";
import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface InitAnswers {
  template: string;
  dbUrl?: string;
  stripeKey?: string;
}

async function init() {
  console.log(chalk.cyan.bold("\n🚀 Welcome to Echos!\n"));
  console.log(chalk.gray("Let's set up your first AI agent in 2 minutes\n"));
  
  const answers = await inquirer.prompt<InitAnswers>([
    {
      type: 'list',
      name: 'template',
      message: 'What do you want your agent to do?',
      choices: [
        { 
          name: '💬 Customer Support - Answer questions using database + search', 
          value: 'customer-support',
          short: 'Customer Support'
        },
        { 
          name: '💳 Stripe Billing - Manage subscriptions and payments', 
          value: 'stripe-billing',
          short: 'Stripe Billing'
        },
        { 
          name: '📊 Data Analyst - Query database and analyze data', 
          value: 'data-analyst',
          short: 'Data Analyst'
        },
        { 
          name: '🔧 Custom - I\'ll configure it myself', 
          value: 'custom',
          short: 'Custom'
        }
      ]
    },
    {
      type: 'input',
      name: 'dbUrl',
      message: 'Database connection URL (optional, press enter to skip):',
      when: (answers: any) => ['customer-support', 'data-analyst'].includes(answers.template)
    },
    {
      type: 'input',
      name: 'stripeKey',
      message: 'Stripe API key (optional, press enter to skip):',
      when: (answers: any) => answers.template === 'stripe-billing'
    }
  ]);
  
  // Copy template file to workflow.yaml
  // Templates are in the package root (templates/), not in dist/
  const packageRoot = path.join(__dirname, '..');
  const templatePath = path.join(packageRoot, 'templates', `${answers.template}.yaml`);
  const targetPath = path.join(process.cwd(), 'workflow.yaml');
  
  if (fs.existsSync(targetPath)) {
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: 'workflow.yaml already exists. Overwrite?',
        default: false
      }
    ]);
    
    if (!overwrite) {
      console.log(chalk.yellow('\n⚠️  Cancelled. Your existing workflow.yaml was not modified.'));
      process.exit(0);
    }
  }
  
  try {
    fs.copyFileSync(templatePath, targetPath);
    console.log(chalk.green('\n✅ Created workflow.yaml'));
  } catch (err: any) {
    console.error(chalk.red(`\n❌ Failed to create workflow.yaml: ${err.message}`));
    process.exit(1);
  }
  
  // Generate .env recommendations
  const envRecommendations: string[] = [];
  
  // Check if .env exists
  const envPath = path.join(process.cwd(), '.env');
  const envExists = fs.existsSync(envPath);
  
  // Add recommendations based on template
  if (!process.env.ECHOS_API_KEY) {
    envRecommendations.push('ECHOS_API_KEY=your_key_here  # Get from http://localhost:3000/settings');
  }
  
  if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    envRecommendations.push('');
    envRecommendations.push('# Choose your LLM provider:');
    envRecommendations.push('# Option 1: OpenAI');
    envRecommendations.push('LLM_PROVIDER=openai');
    envRecommendations.push('OPENAI_API_KEY=sk-...');
    envRecommendations.push('OPENAI_MODEL=gpt-4o  # or gpt-4, gpt-3.5-turbo');
    envRecommendations.push('');
    envRecommendations.push('# Option 2: Anthropic');
    envRecommendations.push('# LLM_PROVIDER=anthropic');
    envRecommendations.push('# ANTHROPIC_API_KEY=sk-ant-...');
    envRecommendations.push('# ANTHROPIC_MODEL=claude-3-5-sonnet-20241022');
  }
  
  if (answers.dbUrl) {
    envRecommendations.push('');
    envRecommendations.push(`DATABASE_URL=${answers.dbUrl}`);
  }
  
  if (answers.stripeKey) {
    envRecommendations.push('');
    envRecommendations.push(`STRIPE_API_KEY=${answers.stripeKey}`);
  }
  
  // Write .env if there are recommendations
  if (envRecommendations.length > 0) {
    if (envExists) {
      console.log(chalk.yellow('\n📝 Add these to your .env file:\n'));
      console.log(chalk.gray(envRecommendations.join('\n')));
    } else {
      fs.writeFileSync(envPath, envRecommendations.join('\n') + '\n');
      console.log(chalk.green('✅ Created .env file'));
      console.log(chalk.yellow('⚠️  Make sure to add your actual API keys!'));
    }
  }
  
  // Show next steps
  console.log(chalk.cyan.bold('\n🎯 Next Steps:\n'));
  
  console.log(chalk.white('1. Get your Echos API key:'));
  console.log(chalk.gray('   • Start the platform: npm run start'));
  console.log(chalk.gray('   • Sign up at: http://localhost:3000/signup'));
  console.log(chalk.gray('   • Copy your API key from Settings'));
  console.log(chalk.gray('   • Add to .env: ECHOS_API_KEY=ek_...\n'));
  
  if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    console.log(chalk.white('2. Add your LLM API key to .env'));
    console.log(chalk.gray('   • OpenAI: https://platform.openai.com/api-keys'));
    console.log(chalk.gray('   • Anthropic: https://console.anthropic.com/\n'));
  }
  
  console.log(chalk.white('3. Try your agent:'));
  console.log(chalk.cyan(`   npx echos "${getExampleTask(answers.template)}"\n`));
  
  console.log(chalk.white('4. View traces at:'));
  console.log(chalk.cyan('   http://localhost:3000\n'));
  
  console.log(chalk.gray('📚 Learn more: https://github.com/treadiehq/echos\n'));
}

function getExampleTask(template: string): string {
  const examples: Record<string, string> = {
    'customer-support': 'What are the top customer issues this week?',
    'stripe-billing': 'List all active subscriptions',
    'data-analyst': 'Analyze sales trends for Q4 2024',
    'custom': 'Your task here'
  };
  return examples[template] || 'Your task here';
}

async function run(task: string) {
  const apiKey = process.env.ECHOS_API_KEY;
  if (!apiKey) {
    console.error(chalk.red("\n❌ ECHOS_API_KEY environment variable is required"));
    console.error(chalk.gray("   Run 'npx echos init' to set up your environment"));
    console.error(chalk.gray("   Or sign up at https://echos.ai to get your API key"));
    console.error(chalk.gray("   Then set: export ECHOS_API_KEY=ek_your_key_here\n"));
    process.exit(1);
  }

  const rt = new EchosRuntime({
    workflow: 'workflow.yaml',
    apiKey
  });

  console.log(chalk.gray("🔐 Validating API key..."));
  
  const res = await rt.run(task);
  console.log(chalk.green("\n✅ Task completed!"));
  console.log(chalk.cyan(`\n📊 View trace: http://localhost:3000/traces/${res.taskId}`));
  console.log(chalk.gray(`   Organization: ${res.orgId}\n`));
}

function showHelp() {
  console.log(chalk.cyan.bold('\n⚡ Echos - Multi-Agent AI Runtime\n'));
  console.log(chalk.white('Usage:\n'));
  console.log(chalk.gray('  npx echos init                     ') + chalk.white('Initialize a new workflow'));
  console.log(chalk.gray('  npx echos "your task"              ') + chalk.white('Run a task with your agents'));
  console.log(chalk.gray('  npx echos --help                   ') + chalk.white('Show this help\n'));
  console.log(chalk.white('Examples:\n'));
  console.log(chalk.gray('  npx echos init'));
  console.log(chalk.gray('  npx echos "Analyze customer sentiment from database"'));
  console.log(chalk.gray('  npx echos "Get active Stripe subscriptions"\n'));
  console.log(chalk.white('Learn more: ') + chalk.cyan('https://github.com/treadiehq/echos\n'));
}

async function main() {
  const args = process.argv.slice(2);
  
  // Handle commands
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showHelp();
    process.exit(0);
  }
  
  if (args[0] === 'init') {
    await init();
    return;
  }
  
  // Otherwise, treat as a task to run
  const task = args.join(" ").trim();
  if (!task) {
    showHelp();
    process.exit(1);
  }
  
  await run(task);
}

main().catch(e => {
  console.error(chalk.red('\n❌ Error:'), e.message);
  console.error(chalk.gray('\nFor help, run: npx echos --help\n'));
  process.exit(1);
});

