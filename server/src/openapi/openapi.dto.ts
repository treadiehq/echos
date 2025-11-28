import { IsOptional, IsNumber, Min, Max, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * SECURITY: DTOs for OpenAPI endpoints
 */

class RateLimitsDto {
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(100)
  requestsPerSecond?: number;
}

class GenerateOptionsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  maxCost?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => RateLimitsDto)
  rateLimits?: RateLimitsDto;

  @IsOptional()
  includeDataAgent?: boolean;
}

export class ParseOpenAPIDto {
  // Can be a URL string (max 2KB) or an object (validated separately)
  // Validation is done in the service layer due to union type
  spec!: string | object;
}

export class GenerateWorkflowFromOpenAPIDto {
  // Can be a URL string (max 2KB) or an object
  // Validation is done in the service layer due to union type
  spec!: string | object;

  @IsOptional()
  @ValidateNested()
  @Type(() => GenerateOptionsDto)
  options?: GenerateOptionsDto;
}

