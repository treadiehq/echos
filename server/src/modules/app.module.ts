import { Module } from '@nestjs/common';
import { TracesController } from '../traces/traces.controller';
import { TracesService } from '../traces/traces.service';
import { HealthController } from '../health/health.controller';
import { WorkflowController } from '../workflow/workflow.controller';
import { WorkflowService } from '../workflow/workflow.service';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    OrganizationsModule,
    ApiKeysModule,
  ],
  controllers: [
    HealthController,
    WorkflowController,
    TracesController,
  ],
  providers: [
    WorkflowService,
    TracesService,
  ],
})
export class AppModule {}
