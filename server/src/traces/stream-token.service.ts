import { Injectable, OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'crypto';

interface StreamToken {
  token: string;
  traceId: string;
  orgId: string;
  userId: string;
  expiresAt: number;
}

@Injectable()
export class StreamTokenService implements OnModuleInit {
  private tokens: Map<string, StreamToken> = new Map();
  private readonly TOKEN_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes

  onModuleInit() {
    // Clean up expired tokens every minute
    setInterval(() => this.cleanupExpiredTokens(), 60 * 1000);
  }

  generateToken(traceId: string, orgId: string, userId: string): string {
    const token = randomBytes(32).toString('hex'); // 64-character hex string
    const expiresAt = Date.now() + this.TOKEN_EXPIRATION_MS;
    
    this.tokens.set(token, {
      token,
      traceId,
      orgId,
      userId,
      expiresAt,
    });
    
    return token;
  }

  validateToken(token: string): StreamToken | null {
    const storedToken = this.tokens.get(token);
    
    if (!storedToken) {
      return null;
    }
    
    if (storedToken.expiresAt < Date.now()) {
      this.tokens.delete(token); // Token expired
      return null;
    }
    
    // Token is valid
    return storedToken;
  }

  cleanupExpiredTokens() {
    const now = Date.now();
    for (const [token, data] of this.tokens.entries()) {
      if (data.expiresAt < now) {
        this.tokens.delete(token);
      }
    }
  }
}
