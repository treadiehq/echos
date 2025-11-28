import { Controller, Get, Inject, Req } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { DatabaseService } from '../database/database.service';

@Controller()
@SkipThrottle() // Don't rate limit health checks
export class HealthController {
  constructor(@Inject(DatabaseService) private db: DatabaseService) {}

  @Get('/health')
  async health() {
    const poolStats = this.db.getPoolStats();
    
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'echos-api',
      version: '0.1.0',
      database: {
        status: 'connected',
        pool: poolStats,
      },
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB',
      },
    };
  }

  @Get('/ping')
  ping() {
    return { pong: true };
  }

  // Detailed health check (for internal monitoring only)
  // SECURITY: Restrict to internal requests or require auth header
  @Get('/health/detailed')
  async detailedHealth(@Req() req: Request) {
    // Only allow from localhost, internal networks, or with secret header
    const clientIP = req.ip || req.socket.remoteAddress || '';
    const internalSecret = req.headers['x-internal-secret'];
    const expectedSecret = process.env.INTERNAL_API_SECRET;
    
    const isLocalhost = clientIP === '127.0.0.1' || clientIP === '::1' || clientIP === '::ffff:127.0.0.1';
    const isInternal = clientIP.startsWith('10.') || clientIP.startsWith('172.') || clientIP.startsWith('192.168.');
    const hasValidSecret = expectedSecret && internalSecret === expectedSecret;
    
    if (!isLocalhost && !isInternal && !hasValidSecret) {
      return {
        error: 'Forbidden',
        message: 'Detailed health endpoint is restricted to internal access',
      };
    }
    const poolStats = this.db.getPoolStats();
    const memUsage = process.memoryUsage();

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'echos-api',
      version: '0.1.0',
      node: process.version,
      platform: process.platform,
      uptime: process.uptime(),
      database: {
        status: 'connected',
        pool: {
          ...poolStats,
          // Health indicators
          utilizationPercent: Math.round((poolStats.totalConnections - poolStats.idleConnections) / Math.max(1, poolStats.totalConnections) * 100),
          hasWaitingClients: poolStats.waitingClients > 0,
        },
      },
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
        unit: 'MB',
      },
      // Warning flags for alerting
      warnings: this.getWarnings(poolStats, memUsage),
    };
  }

  private getWarnings(poolStats: any, memUsage: NodeJS.MemoryUsage): string[] {
    const warnings: string[] = [];
    
    // Pool exhaustion warning
    if (poolStats.waitingClients > 0) {
      warnings.push(`Database pool exhausted: ${poolStats.waitingClients} waiting clients`);
    }
    
    // High pool utilization
    const utilization = (poolStats.totalConnections - poolStats.idleConnections) / Math.max(1, poolStats.totalConnections);
    if (utilization > 0.8) {
      warnings.push(`High database pool utilization: ${Math.round(utilization * 100)}%`);
    }
    
    // Memory warnings (>500MB heap)
    if (memUsage.heapUsed > 500 * 1024 * 1024) {
      warnings.push(`High memory usage: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
    }
    
    return warnings;
  }
}

