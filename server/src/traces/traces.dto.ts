import { IsString, IsOptional, IsUUID, IsObject, MaxLength } from 'class-validator';

/**
 * SECURITY: DTOs for trace endpoints
 */

export class CreateTraceDto {
  @IsOptional()
  @IsUUID()
  orgId?: string;

  @IsOptional()
  @IsUUID()
  workflowId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  workflowName?: string;

  @IsObject()
  data!: any;
}

export class ReplayTraceDto {
  @IsObject()
  workflowConfig!: any;
}

