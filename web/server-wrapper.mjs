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

console.log('✅ Output file found, starting Nitro server...');
console.log('========================================\n');

// Start the Nitro server by executing it
try {
  // Nitro's index.mjs automatically starts the server when imported
  await import('./.output/server/index.mjs');
  console.log('✅ Nitro server started and listening on', `http://${process.env.HOST}:${process.env.PORT}`);
  
  // Keep the process alive indefinitely
  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    process.exit(0);
  });
  
  process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully...');
    process.exit(0);
  });
  
  // Keep process alive
  await new Promise(() => {}); // Never resolves, keeps process running
} catch (error) {
  console.error('\n❌ ERROR starting Nitro server:');
  console.error(error);
  process.exit(1);
}

