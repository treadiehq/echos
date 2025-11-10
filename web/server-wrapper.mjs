#!/usr/bin/env node

console.log('========================================');
console.log('🚀 Echos Frontend Server Starting...');
console.log('========================================');
console.log('Environment:');
console.log('  NODE_ENV:', process.env.NODE_ENV);
console.log('  HOST:', process.env.HOST || '(not set)');
console.log('  PORT:', process.env.PORT || '(not set)');
console.log('  PWD:', process.cwd());
console.log('========================================');

// Check if .output exists
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const outputPath = join(__dirname, '.output', 'server', 'index.mjs');

console.log('Checking for output file:', outputPath);
console.log('File exists:', existsSync(outputPath));

if (!existsSync(outputPath)) {
  console.error('❌ ERROR: .output/server/index.mjs not found!');
  process.exit(1);
}

console.log('✅ Output file found, loading Nitro server...');
console.log('========================================\n');

// Import and start the Nitro server
try {
  await import('./.output/server/index.mjs');
  console.log('\n✅ Nitro server module loaded successfully');
} catch (error) {
  console.error('\n❌ ERROR loading Nitro server:');
  console.error(error);
  process.exit(1);
}

