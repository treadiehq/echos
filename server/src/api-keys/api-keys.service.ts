import { Injectable, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { AuthService } from '../auth/auth.service';

export interface ApiKey {
  id: string;
  key_prefix: string;
  name: string;
  org_id: string;
  created_by: string;
  created_at: Date;
  last_used_at?: Date;
  revoked_at?: Date;
}

@Injectable()
export class ApiKeysService {
  constructor(
    @Inject(DatabaseService) private db: DatabaseService,
    @Inject(AuthService) private authService: AuthService,
    @Inject(OrganizationsService) private orgsService: OrganizationsService
  ) {}

  async createApiKey(orgId: string, userId: string, name: string): Promise<{ apiKey: ApiKey; key: string }> {
    // Check if user can create API keys (must be member)
    const canAccess = await this.orgsService.canUserAccess(orgId, userId);
    if (!canAccess) {
      throw new HttpException('Not authorized to create API keys for this organization', HttpStatus.FORBIDDEN);
    }

    // Check if an API key with this name already exists for this organization
    const existingKey = await this.db.query(
      `SELECT id FROM api_keys WHERE org_id = $1 AND name = $2 AND revoked_at IS NULL`,
      [orgId, name]
    );

    if (existingKey.rows.length > 0) {
      throw new HttpException('An API key with this name already exists', HttpStatus.CONFLICT);
    }

    // Generate the key
    const key = await this.authService.generateApiKey(userId, orgId, name);

    // Fetch the created key record
    const keyPrefix = key.substring(0, 15);
    const result = await this.db.query(
      `SELECT id, key_prefix, name, org_id, created_by, created_at, last_used_at, revoked_at
       FROM api_keys 
       WHERE key_prefix = $1 AND org_id = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [keyPrefix, orgId]
    );

    return {
      apiKey: result.rows[0],
      key, // Only time we return the full key
    };
  }

  async listApiKeys(orgId: string, userId: string): Promise<ApiKey[]> {
    // Check if user is a member
    const canAccess = await this.orgsService.canUserAccess(orgId, userId);
    if (!canAccess) {
      throw new HttpException('Not authorized', HttpStatus.FORBIDDEN);
    }

    const result = await this.db.query(
      `SELECT id, key_prefix, name, org_id, created_by, created_at, last_used_at, revoked_at
       FROM api_keys
       WHERE org_id = $1 AND revoked_at IS NULL
       ORDER BY created_at DESC`,
      [orgId]
    );

    return result.rows;
  }

  async revokeApiKey(keyId: string, orgId: string, userId: string): Promise<void> {
    // Check if user can revoke (must be admin or creator)
    const key = await this.getApiKeyById(keyId);
    
    if (!key) {
      throw new HttpException('API key not found', HttpStatus.NOT_FOUND);
    }

    if (key.org_id !== orgId) {
      throw new HttpException('API key does not belong to this organization', HttpStatus.BAD_REQUEST);
    }

    const canAccess = await this.orgsService.canUserAccess(orgId, userId, 'admin');
    const isCreator = key.created_by === userId;

    if (!canAccess && !isCreator) {
      throw new HttpException('Not authorized to revoke this API key', HttpStatus.FORBIDDEN);
    }

    await this.db.query(
      `UPDATE api_keys SET revoked_at = NOW() WHERE id = $1`,
      [keyId]
    );
  }

  async getApiKeyById(keyId: string): Promise<ApiKey | null> {
    const result = await this.db.query(
      `SELECT id, key_prefix, name, org_id, created_by, created_at, last_used_at, revoked_at
       FROM api_keys
       WHERE id = $1`,
      [keyId]
    );

    return result.rows[0] || null;
  }
}

