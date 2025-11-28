import { Controller, Post, Get, Body, Query, Res, Req, HttpException, HttpStatus, UseGuards, Inject } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { MagicLinkDto, VerifyTokenDto } from './auth.dto';
import { Response, Request } from 'express';
import { AuthGuard } from './guards/auth.guard';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private authService: AuthService) {}

  // SECURITY: Strict rate limit to prevent email enumeration and spam
  @Throttle({ default: { ttl: 60000, limit: 5 } }) // 5 per minute
  @Post('send-magic-link')
  async sendMagicLink(@Body() body: MagicLinkDto) {
    if (!body.email || !this.isValidEmail(body.email)) {
      throw new HttpException('Valid email is required', HttpStatus.BAD_REQUEST);
    }
    
    // If it's a sign-up, org name is required
    if (body.isSignup && !body.orgName) {
      throw new HttpException('Organization name is required for sign-up', HttpStatus.BAD_REQUEST);
    }

    try {
      const result = await this.authService.sendMagicLink(body.email, body.orgName, body.isSignup);
      return result;
    } catch (error) {
      // SECURITY: Don't reveal if email exists or not (prevent enumeration)
      // Always return success message to prevent timing attacks
      if (process.env.NODE_ENV === 'production') {
        return { 
          success: true, 
          message: 'If this email is registered, a magic link has been sent' 
        };
      }
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to send magic link',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // SECURITY: Rate limit token verification to prevent brute force
  @Throttle({ default: { ttl: 60000, limit: 10 } }) // 10 per minute
  @Get('verify')
  async verifyMagicLink(
    @Query('token') token: string,
    @Res() res: Response
  ) {
    if (!token || token.length < 20 || token.length > 100) {
      throw new HttpException('Invalid token format', HttpStatus.BAD_REQUEST);
    }

    try {
      const { user, sessionToken, isSignup } = await this.authService.verifyMagicLink(token);

      const isProduction = process.env.NODE_ENV === 'production';

      // SECURITY: Set secure cookie with proper flags
      res.cookie('session_token', sessionToken, {
        httpOnly: true,           // Prevent XSS access to cookie
        secure: isProduction,     // HTTPS only in production
        sameSite: 'lax',          // CSRF protection
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        path: '/',                // Available on all paths
        ...(isProduction && { domain: process.env.COOKIE_DOMAIN }), // Set domain in production
      });

      // Redirect to app - onboarding for sign-ups, home for logins
      const redirectUrl = process.env.APP_URL || 'http://localhost:3000';
      if (isSignup) {
        res.redirect(`${redirectUrl}/onboarding`);
      } else {
        res.redirect(`${redirectUrl}?login=success`);
      }
    } catch (error) {
      const redirectUrl = process.env.APP_URL || 'http://localhost:3000';
      res.redirect(`${redirectUrl}/login?error=${encodeURIComponent(error instanceof Error ? error.message : 'Authentication failed')}`);
    }
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async getCurrentUser(@Req() req: Request) {
    // User is already attached by the AuthGuard
    if (!req.user) {
      throw new HttpException('Not authenticated', HttpStatus.UNAUTHORIZED);
    }

    return { 
      user: req.user,
      orgId: req.orgId // Will be set if authenticated via API key
    };
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    const sessionToken = req.cookies?.session_token;

    if (sessionToken) {
      await this.authService.revokeSession(sessionToken);
    }

    res.clearCookie('session_token');
    res.json({ success: true });
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

