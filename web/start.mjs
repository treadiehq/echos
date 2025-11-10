#!/usr/bin/env node

// Comprehensive startup script with debugging
console.log('================================');
console.log('🚀 Echos Frontend Starting...');
console.log('================================');

// Log all environment variables related to the server
console.log('\n📍 Environment:');
console.log('  NODE_ENV:', process.env.NODE_ENV);
console.log('  PORT:', process.env.PORT);
console.log('  HOST:', process.env.HOST);
console.log('  NITRO_PORT:', process.env.NITRO_PORT);
console.log('  NITRO_HOST:', process.env.NITRO_HOST);
console.log('  PWD:', process.cwd());

// Set Nitro-specific variables from Railway's PORT
if (process.env.PORT) {
  process.env.NITRO_PORT = process.env.PORT;
  console.log('\n✅ Set NITRO_PORT to:', process.env.NITRO_PORT);
}

if (!process.env.NITRO_HOST) {
  process.env.NITRO_HOST = '0.0.0.0';
  console.log('✅ Set NITRO_HOST to:', process.env.NITRO_HOST);
}

console.log('\n📦 Starting Nuxt/Nitro server...');
console.log('================================\n');

// Import and start the Nitro server
import('./.output/server/index.mjs').catch((error) => {
  console.error('\n❌ Failed to start server:');
  console.error(error);
  console.error('\n Stack trace:');
  console.error(error.stack);
  process.exit(1);
});

// Keep the process alive and log any exits
process.on('exit', (code) => {
  console.log(`\n⚠️  Process exiting with code: ${code}`);
});

process.on('uncaughtException', (error) => {
  console.error('\n❌ Uncaught Exception:');
  console.error(error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n❌ Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  process.exit(1);
});

console.log('✅ Startup script initialized\n');

