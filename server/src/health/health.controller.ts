import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('/health')
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'echos-api',
      version: '0.1.0'
    };
  }

  @Get('/ping')
  ping() {
    return { pong: true };
  }
}

