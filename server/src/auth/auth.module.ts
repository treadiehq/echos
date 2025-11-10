import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { ApiKeyGuard } from './guards/api-key.guard';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, ApiKeyGuard],
  exports: [AuthService, AuthGuard, ApiKeyGuard],
})
export class AuthModule {}

