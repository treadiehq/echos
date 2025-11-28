import { IsString, IsOptional, MaxLength, MinLength, IsUUID, Matches } from 'class-validator';

/**
 * SECURITY: DTOs with validation to prevent:
 * - Storage bombs (unlimited string lengths)
 * - SQL injection via overly long strings
 * - Memory exhaustion
 */

export class CreateWorkflowDto {
  @IsUUID()
  orgId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  @Matches(/^[a-zA-Z0-9\s\-_]+$/, {
    message: 'Name can only contain alphanumeric characters, spaces, hyphens, and underscores',
  })
  name!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(500000) // 500KB max YAML config
  yamlConfig!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class UpdateWorkflowDto {
  @IsOptional()
  @IsUUID()
  orgId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  @Matches(/^[a-zA-Z0-9\s\-_]+$/, {
    message: 'Name can only contain alphanumeric characters, spaces, hyphens, and underscores',
  })
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(500000) // 500KB max YAML config
  yamlConfig?: string;
}

export class RunWorkflowDto {
  @IsString()
  @MinLength(1)
  @MaxLength(10000) // 10KB max task description
  task!: string;

  @IsOptional()
  memory?: Record<string, unknown>;
}

