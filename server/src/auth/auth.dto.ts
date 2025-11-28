import { IsString, IsEmail, IsOptional, MaxLength, MinLength, IsBoolean, Matches, IsUUID } from 'class-validator';

/**
 * SECURITY: DTOs for auth endpoints
 */

export class MagicLinkDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[a-zA-Z0-9\s\-_]+$/, {
    message: 'Organization name can only contain alphanumeric characters, spaces, hyphens, and underscores',
  })
  orgName?: string;

  @IsOptional()
  @IsBoolean()
  isSignup?: boolean;
}

export class VerifyTokenDto {
  @IsString()
  @MinLength(20)
  @MaxLength(100)
  token!: string;
}

export class CreateApiKeyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^[a-zA-Z0-9\s\-_]+$/, {
    message: 'API key name can only contain alphanumeric characters, spaces, hyphens, and underscores',
  })
  name!: string;

  @IsUUID()
  orgId!: string;
}

