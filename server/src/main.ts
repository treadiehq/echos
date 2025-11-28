import { config } from 'dotenv';
import { resolve } from 'path';
// Load .env from project root (parent directory) - only in local development
// Skip if RAILWAY_ENVIRONMENT is set (Railway deployment) or NODE_ENV is production
if (!process.env.RAILWAY_ENVIRONMENT && process.env.NODE_ENV !== 'production') {
  config({ path: resolve(__dirname, '../../.env') });
}

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './modules/app.module';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';

async function bootstrap() {
  // SECURITY: Require JWT_SECRET in production
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    console.error('❌ FATAL: JWT_SECRET environment variable is required in production');
    process.exit(1);
  }

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
    },
    bodyParser: true,
  });

  // SECURITY: Helmet for security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    crossOriginEmbedderPolicy: false, // Allow embedding for SSE
  }));
  
  // SECURITY: Reduced body size limit (1MB instead of 50MB)
  // For large OpenAPI specs, increase per-route if needed
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ limit: '1mb', extended: true }));
  
  // Cookie parser with secure settings
  const isProduction = process.env.NODE_ENV === 'production';
  app.use(cookieParser());

  // SECURITY: Global validation pipe for DTOs
  app.use(ValidationPipe, {
    whitelist: true, // Strip unknown properties
    forbidNonWhitelisted: true, // Throw on unknown properties
    transform: true, // Auto-transform payloads to DTO instances
  });
  
  const port = process.env.PORT || 4000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`🚀 Echos API server listening on http://localhost:${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`🛡️  Security: Rate limiting, Helmet, and validation enabled`);
}
bootstrap();

