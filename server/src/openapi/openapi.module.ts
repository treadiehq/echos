import { Module } from '@nestjs/common';
import { OpenAPIController } from './openapi.controller';
import { OpenAPIParserService } from './openapi-parser.service';
import { WorkflowGeneratorService } from './workflow-generator.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [OpenAPIParserService, WorkflowGeneratorService],
  controllers: [OpenAPIController],
  exports: [OpenAPIParserService, WorkflowGeneratorService],
})
export class OpenAPIModule {}

