// Custom server wrapper with explicit logging
console.log('🚀 Echos Frontend Starting...');
console.log(`📍 HOST: ${process.env.HOST || '0.0.0.0'}`);
console.log(`📍 PORT: ${process.env.PORT || '3000'}`);
console.log(`📍 NODE_ENV: ${process.env.NODE_ENV}`);
console.log('✅ Loading Nuxt server...');

// Import and start the Nuxt server
import('./.output/server/index.mjs').catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});

