import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { Resend } from 'resend';
import { randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

// Generate random ID compatible with CommonJS
function nanoid(length = 32): string {
  return randomBytes(length).toString('base64url').substring(0, length);
}

export interface User {
  id: string;
  email: string;
  name?: string;
  created_at: Date;
}

export interface Session {
  id: string;
  user_id: string;
  token: string;
  expires_at: Date;
}

@Injectable()
export class AuthService {
  private resend: Resend | null = null;
  private jwtSecret: string;

  constructor(
    @Inject(DatabaseService) private db: DatabaseService,
    @Inject(forwardRef(() => OrganizationsService)) private organizationsService: OrganizationsService
  ) {
    // Initialize Resend only in production
    if (process.env.RESEND_API_KEY) {
      this.resend = new Resend(process.env.RESEND_API_KEY);
    }

    // SECURITY: JWT_SECRET is required - no fallback to prevent accidental insecure deployments
    if (!process.env.JWT_SECRET) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('FATAL: JWT_SECRET environment variable is required in production');
      }
      // Development only: generate a random secret per-run (sessions won't persist across restarts)
      this.jwtSecret = require('crypto').randomBytes(32).toString('hex');
      console.warn('⚠️  JWT_SECRET not set - using random secret (sessions will not persist across restarts)');
    } else {
      this.jwtSecret = process.env.JWT_SECRET;
    }
  }

  async sendMagicLink(email: string, orgName?: string, isSignup?: boolean): Promise<{ success: boolean; message: string }> {
    // Normalize email
    email = email.toLowerCase().trim();

    // For login (not sign-up), check if user exists
    if (!isSignup) {
      const existingUser = await this.getUserByEmail(email);
      if (!existingUser) {
        throw new Error('No account found with this email. Please sign up first.');
      }
    }

    // For sign-up, validate organization name EARLY (before sending magic link)
    if (isSignup && orgName) {
      const trimmedOrgName = orgName.trim();
      
      // Check reserved names
      const { isReservedName, isSimilarToReservedName } = await import('../organizations/reserved-names');
      
      if (isReservedName(trimmedOrgName)) {
        throw new Error('This organization name is reserved and cannot be used');
      }
      
      if (isSimilarToReservedName(trimmedOrgName)) {
        throw new Error('This organization name is too similar to a reserved name');
      }

      // Check if organization name already exists
      const existingOrg = await this.db.query(
        'SELECT id FROM organizations WHERE LOWER(name) = LOWER($1)',
        [trimmedOrgName]
      );
      
      if (existingOrg.rows.length > 0) {
        throw new Error('An organization with this name already exists');
      }
    }

    // Generate token
    const token = nanoid(32);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store magic link in database (use NOW() + interval for expires_at to handle timezone correctly)
    await this.db.query(
      `INSERT INTO magic_links (email, token, expires_at, org_name, is_signup) 
       VALUES ($1, $2, NOW() + INTERVAL '15 minutes', $3, $4)`,
      [email, token, orgName || null, isSignup || false]
    );

    const magicLinkUrl = `${this.getBaseUrl()}/auth/verify?token=${token}`;

    // Send via email in production, log in development
    if (this.resend && process.env.NODE_ENV === 'production') {
      try {
        const subject = isSignup ? 'Welcome to Echos!' : 'Sign in to Echos';
        const emailTemplate = isSignup 
          ? this.getSignUpEmailTemplate(magicLinkUrl)
          : this.getSignInEmailTemplate(magicLinkUrl);

        await this.resend.emails.send({
          from: process.env.FROM_EMAIL || 'Echos <noreply@echoshq.com>',
          to: email,
          subject: subject,
          html: emailTemplate,
        });

        return {
          success: true,
          message: 'Magic link sent to your email',
        };
      } catch (error) {
        console.error('Failed to send email:', error);
        throw new Error('Failed to send magic link email');
      }
    } else {
      // Local development - log to console
      console.log('\n🔐 ═══════════════════════════════════════════════════════');
      console.log('   MAGIC LINK LOGIN');
      console.log('═══════════════════════════════════════════════════════');
      console.log(`📧 Email: ${email}`);
      console.log(`🔗 Link:  ${magicLinkUrl}`);
      console.log(`⏰ Expires: ${expiresAt.toLocaleString()}`);
      console.log('═══════════════════════════════════════════════════════\n');

      return {
        success: true,
        message: 'Magic link logged to console (development mode)',
      };
    }
  }

  async verifyMagicLink(token: string): Promise<{ user: User; sessionToken: string; isSignup: boolean }> {
    // Find the magic link
    const result = await this.db.query(
      `SELECT * FROM magic_links 
       WHERE token = $1 AND expires_at > NOW() AND used_at IS NULL`,
      [token]
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid or expired magic link');
    }

    const magicLink = result.rows[0];
    const isSignup = magicLink.is_signup;
    const orgName = magicLink.org_name;

    // Mark as used
    await this.db.query(
      `UPDATE magic_links SET used_at = NOW() WHERE id = $1`,
      [magicLink.id]
    );

    // Get or create user
    let user = await this.getUserByEmail(magicLink.email);
    if (!user) {
      user = await this.createUser(magicLink.email);
      
      // If this is a sign-up with an org name, create the organization
      if (isSignup && orgName) {
        await this.createOrganizationForUser(user.id, orgName);
      }
    }

    // Create session
    const sessionToken = this.generateSessionToken(user.id);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await this.db.query(
      `INSERT INTO sessions (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, sessionToken, expiresAt]
    );

    return { user, sessionToken, isSignup };
  }
  
  private async createOrganizationForUser(userId: string, orgName: string): Promise<void> {
    // Use the organizations service which has all validation logic
    // (reserved names, duplicate names, etc.)
    await this.organizationsService.createOrganization(orgName, userId);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const result = await this.db.query(
      `SELECT * FROM users WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    return result.rows[0] || null;
  }

  async createUser(email: string): Promise<User> {
    const result = await this.db.query(
      `INSERT INTO users (email) VALUES ($1) RETURNING *`,
      [email.toLowerCase().trim()]
    );

    return result.rows[0];
  }

  async getUserBySessionToken(token: string): Promise<User | null> {
    const result = await this.db.query(
      `SELECT u.* FROM users u
       JOIN sessions s ON s.user_id = u.id
       WHERE s.token = $1 AND s.expires_at > NOW()`,
      [token]
    );

    if (result.rows.length > 0) {
      // Update last active
      await this.db.query(
        `UPDATE sessions SET last_active_at = NOW() WHERE token = $1`,
        [token]
      );
    }

    return result.rows[0] || null;
  }

  async revokeSession(token: string): Promise<void> {
    await this.db.query(`DELETE FROM sessions WHERE token = $1`, [token]);
  }

  async getUserById(userId: string): Promise<User | null> {
    const result = await this.db.query(
      `SELECT * FROM users WHERE id = $1`,
      [userId]
    );

    return result.rows[0] || null;
  }

  async generateApiKey(userId: string, orgId: string, name: string): Promise<string> {
    // Generate key: ek_live_xxxxx or ek_test_xxxxx
    const env = process.env.NODE_ENV === 'production' ? 'live' : 'test';
    const randomPart = nanoid(32);
    const apiKey = `ek_${env}_${randomPart}`;
    
    // Hash the key for storage
    const keyHash = await bcrypt.hash(apiKey, 10);
    const keyPrefix = apiKey.substring(0, 15);

    await this.db.query(
      `INSERT INTO api_keys (key_hash, key_prefix, name, org_id, created_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [keyHash, keyPrefix, name, orgId, userId]
    );

    return apiKey;
  }

  async verifyApiKey(apiKey: string): Promise<{ userId: string; orgId: string } | null> {
    try {
      // Get the prefix
      const prefix = apiKey.substring(0, 15);

      // Find all keys with this prefix (should be very few)
      const result = await this.db.query(
        `SELECT * FROM api_keys 
         WHERE key_prefix = $1 AND revoked_at IS NULL`,
        [prefix]
      );

      // Check each key's hash
      for (const key of result.rows) {
        const isValid = await bcrypt.compare(apiKey, key.key_hash);
        
        if (isValid) {
          // Update last used
          await this.db.query(
            `UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`,
            [key.id]
          );

          return {
            userId: key.created_by,
            orgId: key.org_id,
          };
        }
      }

      return null;
    } catch (error) {
      console.error('[AuthService] Error verifying API key:', error);
      return null;
    }
  }

  async getUserPrimaryOrgId(userId: string): Promise<string | null> {
    try {
      const result = await this.db.query(
        `SELECT org_id FROM org_members WHERE user_id = $1 LIMIT 1`,
        [userId]
      );
      
      return result.rows[0]?.org_id || null;
    } catch (error) {
      console.error('[AuthService] Error getting user primary org:', error);
      return null;
    }
  }

  private generateSessionToken(userId: string): string {
    return jwt.sign({ userId }, this.jwtSecret, { expiresIn: '30d' });
  }

  private getBaseUrl(): string {
    return process.env.BASE_URL || 'http://localhost:3000';
  }

  private getSignInEmailTemplate(magicLink: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Sign in to Echos</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="padding: 40px;">
            <h2 style="color: #ffffff; margin-top: 0;">Sign in to your account</h2>
            <p style="font-size: 16px; color: #666;">Click the button below to securely sign in to your Echos account:</p>
            
            <div style="text-align: center; margin: 40px 0;">
              <a href="${magicLink}" style="background: oklch(80.9% 0.105 251.813); color: black; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                Sign In
              </a>
            </div>
            
            <p style="font-size: 14px; color: #999; margin-top: 40px;">
              This link will expire in 15 minutes. If you didn't request this email, you can safely ignore it.
            </p>
            
            <p style="font-size: 12px; color: #ccc; margin-top: 30px; padding-top: 30px; border-top: 1px solid #e0e0e0;">
              Or copy and paste this URL into your browser:<br>
              <span style="color: #667eea; word-break: break-all;">${magicLink}</span>
            </p>
          </div>
        </body>
      </html>
    `;
  }

  private getSignUpEmailTemplate(magicLink: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Echos</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="padding: 40px;">
            <h2 style="color: #ffffff; margin-top: 0;">Welcome to Echos! 🎉</h2>
            <p style="font-size: 16px; color: #666;">We're excited to have you on board! Click the button below to verify your email and complete your account setup:</p>
            
            <div style="text-align: center; margin: 40px 0;">
              <a href="${magicLink}" style="background: oklch(80.9% 0.105 251.813); color: black; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                Complete Sign Up
              </a>
            </div>
            
            <p style="font-size: 14px; color: #999; margin-top: 40px;">
              This link will expire in 15 minutes. If you didn't create an account, you can safely ignore this email.
            </p>
            
            <p style="font-size: 12px; color: #ccc; margin-top: 30px; padding-top: 30px; border-top: 1px solid #e0e0e0;">
              Or copy and paste this URL into your browser:<br>
              <span style="color: #667eea; word-break: break-all;">${magicLink}</span>
            </p>
          </div>
        </body>
      </html>
    `;
  }
}

