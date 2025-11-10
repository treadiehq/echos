import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Inject } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { Request } from 'express';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
      orgId?: string;
    }
  }
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(AuthService) private authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    
    // Check for session token in cookies
    const sessionToken = request.cookies?.session_token;
    
    if (sessionToken) {
      const user = await this.authService.getUserBySessionToken(sessionToken);
      if (user) {
        request.user = user;
        // Get user's primary organization for session-based auth
        const orgId = await this.authService.getUserPrimaryOrgId(user.id);
        if (orgId) {
          request.orgId = orgId;
        }
        return true;
      }
    }

    // Check for API key in Authorization header
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const apiKey = authHeader.substring(7);
      const result = await this.authService.verifyApiKey(apiKey);
      
      if (result) {
        const user = await this.authService.getUserById(result.userId);
        if (user) {
          request.user = user;
          request.orgId = result.orgId;
          return true;
        }
      }
    }

    throw new UnauthorizedException('Authentication required');
  }
}

