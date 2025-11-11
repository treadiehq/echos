import { config } from 'dotenv';
import { resolve } from 'path';
// Load .env from project root (parent directory) - only in local development
// Skip if RAILWAY_ENVIRONMENT is set (Railway deployment) or NODE_ENV is production
if (!process.env.RAILWAY_ENVIRONMENT && process.env.NODE_ENV !== 'production') {
  config({ path: resolve(__dirname, '../../.env') });
}

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app.module';
import cors from 'cors';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  // CORS Configuration - must be done BEFORE creating the app
  const corsOrigins = process.env.CORS_ORIGIN 
    ? process.env.CORS_ORIGIN.split(',')
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];
  
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['Set-Cookie'],
    }
  });
  
  // Cookie parser
  app.use(cookieParser());
  
  const port = process.env.PORT || 4000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`🚀 Echos API server listening on http://localhost:${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
}
bootstrap();

