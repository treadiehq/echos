import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Inject } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(@Inject(AuthService) private authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('API key required');
    }

    const apiKey = authHeader.substring(7);
    const result = await this.authService.verifyApiKey(apiKey);
    
    if (!result) {
      throw new UnauthorizedException('Invalid API key');
    }

    const user = await this.authService.getUserById(result.userId);
    if (!user) {
      throw new UnauthorizedException('Invalid API key');
    }

    request.user = user;
    request.orgId = result.orgId;
    
    return true;
  }
}

