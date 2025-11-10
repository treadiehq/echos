import { Controller, Get, Post, Delete, Body, Param, Req, UseGuards, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { Request } from 'express';

@Controller('organizations/:orgId/api-keys')
@UseGuards(AuthGuard)
export class ApiKeysController {
  constructor(@Inject(ApiKeysService) private apiKeysService: ApiKeysService) {}

  @Post()
  async createApiKey(
    @Param('orgId') orgId: string,
    @Body() body: { name: string },
    @Req() req: Request
  ) {
    if (!body.name || body.name.trim().length === 0) {
      throw new HttpException('API key name is required', HttpStatus.BAD_REQUEST);
    }

    const result = await this.apiKeysService.createApiKey(
      orgId,
      req.user.id,
      body.name
    );

    return {
      apiKey: result.apiKey,
      key: result.key,
      message: 'Save this key securely - you won\'t be able to see it again!'
    };
  }

  @Get()
  async listApiKeys(
    @Param('orgId') orgId: string,
    @Req() req: Request
  ) {
    const keys = await this.apiKeysService.listApiKeys(orgId, req.user.id);
    return { apiKeys: keys };
  }

  @Delete(':keyId')
  async revokeApiKey(
    @Param('orgId') orgId: string,
    @Param('keyId') keyId: string,
    @Req() req: Request
  ) {
    await this.apiKeysService.revokeApiKey(keyId, orgId, req.user.id);
    return { success: true };
  }
}

