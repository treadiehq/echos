import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { TracesController } from '../traces/traces.controller';
import { TracesService } from '../traces/traces.service';
import { StreamTokenService } from '../traces/stream-token.service';
import { HealthController } from '../health/health.controller';
import { WorkflowController } from '../workflow/workflow.controller';
import { WorkflowService } from '../workflow/workflow.service';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { OpenAPIModule } from '../openapi/openapi.module';

@Module({
  imports: [
    // SECURITY: Rate limiting - 100 requests per minute per IP
    ThrottlerModule.forRoot([{
      name: 'short',
      ttl: 1000,   // 1 second
      limit: 10,   // 10 requests per second
    }, {
      name: 'medium', 
      ttl: 10000,  // 10 seconds
      limit: 50,   // 50 requests per 10 seconds
    }, {
      name: 'long',
      ttl: 60000,  // 1 minute
      limit: 100,  // 100 requests per minute
    }]),
    DatabaseModule,
    AuthModule,
    OrganizationsModule,
    ApiKeysModule,
    OpenAPIModule,
  ],
  controllers: [
    HealthController,
    WorkflowController,
    TracesController,
  ],
  providers: [
    WorkflowService,
    TracesService,
    StreamTokenService,
    // SECURITY: Apply rate limiting globally
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
