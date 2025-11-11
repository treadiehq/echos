import { Injectable, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { randomBytes } from 'crypto';
import { isReservedName, isSimilarToReservedName } from './reserved-names';

// Generate random ID compatible with CommonJS
function nanoid(length = 32): string {
  return randomBytes(length).toString('base64url').substring(0, length);
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: Date;
  created_by?: string;
}

export interface OrganizationMember {
  id: string;
  user_id: string;
  org_id: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joined_at: Date;
  user?: {
    email: string;
    name?: string;
  };
}

@Injectable()
export class OrganizationsService {
  constructor(@Inject(DatabaseService) private db: DatabaseService) {}

  async createOrganization(name: string, userId: string): Promise<Organization> {
    const trimmedName = name.trim();

    // Check if name is reserved
    if (isReservedName(trimmedName)) {
      throw new HttpException('This organization name is reserved and cannot be used', HttpStatus.BAD_REQUEST);
    }

    // Check if name is too similar to reserved names (optional strict check)
    if (isSimilarToReservedName(trimmedName)) {
      throw new HttpException('This organization name is too similar to a reserved name', HttpStatus.BAD_REQUEST);
    }

    // Check if organization name already exists (case-insensitive)
    const existingOrg = await this.getOrganizationByName(trimmedName);
    if (existingOrg) {
      throw new HttpException('An organization with this name already exists', HttpStatus.CONFLICT);
    }

    // Generate slug from name
    let slug = trimmedName.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    
    // Ensure slug is unique
    let uniqueSlug = slug;
    let counter = 1;
    while (await this.getOrganizationBySlug(uniqueSlug)) {
      uniqueSlug = `${slug}-${counter}`;
      counter++;
    }

    // Create organization
    const result = await this.db.query(
      `INSERT INTO organizations (name, slug, created_by)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [trimmedName, uniqueSlug, userId]
    );

    const org = result.rows[0];

    // Add creator as owner
    await this.addMember(org.id, userId, 'owner');

    return org;
  }

  async getOrganizationById(id: string): Promise<Organization | null> {
    const result = await this.db.query(
      `SELECT * FROM organizations WHERE id = $1`,
      [id]
    );

    return result.rows[0] || null;
  }

  async getOrganizationBySlug(slug: string): Promise<Organization | null> {
    const result = await this.db.query(
      `SELECT * FROM organizations WHERE slug = $1`,
      [slug]
    );

    return result.rows[0] || null;
  }

  async getOrganizationByName(name: string): Promise<Organization | null> {
    const result = await this.db.query(
      `SELECT * FROM organizations WHERE LOWER(name) = LOWER($1)`,
      [name]
    );

    return result.rows[0] || null;
  }

  async getUserOrganizations(userId: string): Promise<Organization[]> {
    const result = await this.db.query(
      `SELECT o.* FROM organizations o
       JOIN org_members om ON om.org_id = o.id
       WHERE om.user_id = $1
       ORDER BY o.created_at DESC`,
      [userId]
    );

    return result.rows;
  }

  async getOrganizationMembers(orgId: string, userId: string): Promise<OrganizationMember[]> {
    // Check if user is a member
    const isMember = await this.isUserMember(orgId, userId);
    if (!isMember) {
      throw new HttpException('Not authorized', HttpStatus.FORBIDDEN);
    }

    const result = await this.db.query(
      `SELECT om.*, u.email, u.name 
       FROM org_members om
       JOIN users u ON u.id = om.user_id
       WHERE om.org_id = $1
       ORDER BY om.joined_at ASC`,
      [orgId]
    );

    return result.rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      org_id: row.org_id,
      role: row.role,
      joined_at: row.joined_at,
      user: {
        email: row.email,
        name: row.name,
      },
    }));
  }

  async addMember(orgId: string, userId: string, role: 'owner' | 'admin' | 'member' | 'viewer' = 'member'): Promise<void> {
    await this.db.query(
      `INSERT INTO org_members (org_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, org_id) DO NOTHING`,
      [orgId, userId, role]
    );
  }

  async updateMemberRole(orgId: string, userId: string, requesterId: string, newRole: 'owner' | 'admin' | 'member' | 'viewer'): Promise<void> {
    // Check if requester is owner or admin
    const requesterRole = await this.getUserRole(orgId, requesterId);
    if (requesterRole !== 'owner' && requesterRole !== 'admin') {
      throw new HttpException('Not authorized to update roles', HttpStatus.FORBIDDEN);
    }

    // Can't change your own role
    if (userId === requesterId) {
      throw new HttpException('Cannot change your own role', HttpStatus.BAD_REQUEST);
    }

    await this.db.query(
      `UPDATE org_members SET role = $1 WHERE org_id = $2 AND user_id = $3`,
      [newRole, orgId, userId]
    );
  }

  async removeMember(orgId: string, userId: string, requesterId: string): Promise<void> {
    // Check if requester is owner or admin
    const requesterRole = await this.getUserRole(orgId, requesterId);
    if (requesterRole !== 'owner' && requesterRole !== 'admin') {
      throw new HttpException('Not authorized to remove members', HttpStatus.FORBIDDEN);
    }

    // Check if target is owner
    const targetRole = await this.getUserRole(orgId, userId);
    if (targetRole === 'owner') {
      throw new HttpException('Cannot remove organization owner', HttpStatus.BAD_REQUEST);
    }

    await this.db.query(
      `DELETE FROM org_members WHERE org_id = $1 AND user_id = $2`,
      [orgId, userId]
    );
  }

  async getUserRole(orgId: string, userId: string): Promise<string | null> {
    const result = await this.db.query(
      `SELECT role FROM org_members WHERE org_id = $1 AND user_id = $2`,
      [orgId, userId]
    );

    return result.rows[0]?.role || null;
  }

  async isUserMember(orgId: string, userId: string): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1 FROM org_members WHERE org_id = $1 AND user_id = $2`,
      [orgId, userId]
    );

    return result.rows.length > 0;
  }

  async canUserAccess(orgId: string, userId: string, requiredRole?: 'owner' | 'admin'): Promise<boolean> {
    const role = await this.getUserRole(orgId, userId);
    
    if (!role) return false;
    
    if (!requiredRole) return true;
    
    if (requiredRole === 'owner') {
      return role === 'owner';
    }
    
    if (requiredRole === 'admin') {
      return role === 'owner' || role === 'admin';
    }
    
    return true;
  }

  async deleteOrganization(orgId: string, userId: string): Promise<void> {
    // Only owner can delete
    const role = await this.getUserRole(orgId, userId);
    if (role !== 'owner') {
      throw new HttpException('Only organization owner can delete', HttpStatus.FORBIDDEN);
    }

    await this.db.query(`DELETE FROM organizations WHERE id = $1`, [orgId]);
  }

  async updateOrganization(orgId: string, userId: string, updates: { name?: string }): Promise<Organization> {
    // Check if user can update (owner or admin)
    const canUpdate = await this.canUserAccess(orgId, userId, 'admin');
    if (!canUpdate) {
      throw new HttpException('Not authorized to update organization', HttpStatus.FORBIDDEN);
    }

    // If updating name, validate it
    if (updates.name) {
      const trimmedName = updates.name.trim();

      // Check if name is reserved
      if (isReservedName(trimmedName)) {
        throw new HttpException('This organization name is reserved and cannot be used', HttpStatus.BAD_REQUEST);
      }

      // Check if name is too similar to reserved names
      if (isSimilarToReservedName(trimmedName)) {
        throw new HttpException('This organization name is too similar to a reserved name', HttpStatus.BAD_REQUEST);
      }

      // Check if another organization has this name (case-insensitive)
      const existingOrg = await this.getOrganizationByName(trimmedName);
      if (existingOrg && existingOrg.id !== orgId) {
        throw new HttpException('An organization with this name already exists', HttpStatus.CONFLICT);
      }

      updates.name = trimmedName;
    }

    const result = await this.db.query(
      `UPDATE organizations SET name = COALESCE($1, name), updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [updates.name, orgId]
    );

    return result.rows[0];
  }
}

