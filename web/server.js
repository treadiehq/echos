// Custom server wrapper with explicit logging
console.log('🚀 Echos Frontend Starting...');
console.log(`📍 HOST: ${process.env.HOST || '0.0.0.0'}`);
console.log(`📍 PORT: ${process.env.PORT || '3000'}`);
console.log(`📍 NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`📍 PWD: ${process.cwd()}`);
console.log('✅ Loading Nuxt server...');

// Import and start the Nuxt server
import('./.output/server/index.mjs')
  .then(() => {
    console.log('✅ Nuxt server loaded successfully');
  })
  .catch((err) => {
    console.error('❌ Failed to start server:', err);
    console.error('Stack:', err.stack);
    process.exit(1);
  });

// Log if process exits
process.on('exit', (code) => {
  console.log(`Process exiting with code: ${code}`);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

console.log('✅ Server initialization complete');

