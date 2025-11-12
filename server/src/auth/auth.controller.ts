import { Controller, Post, Get, Body, Query, Res, Req, HttpException, HttpStatus, UseGuards, Inject } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Response, Request } from 'express';
import { AuthGuard } from './guards/auth.guard';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private authService: AuthService) {}

  @Post('send-magic-link')
  async sendMagicLink(@Body() body: { email: string; orgName?: string; isSignup?: boolean }) {
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
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to send magic link',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('verify')
  async verifyMagicLink(
    @Query('token') token: string,
    @Res() res: Response
  ) {
    if (!token) {
      throw new HttpException('Token is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const { user, sessionToken, isSignup } = await this.authService.verifyMagicLink(token);

      // console.log('🔍 Verify debug:', { userId: user.id, email: user.email, isSignup });

      // Set cookie
      res.cookie('session_token', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      // Redirect to app - onboarding for sign-ups, home for logins
      const redirectUrl = process.env.APP_URL || 'http://localhost:3000';
      if (isSignup) {
        // console.log('✅ Redirecting to onboarding (sign-up)');
        res.redirect(`${redirectUrl}/onboarding`);
      } else {
        // console.log('✅ Redirecting to home (login)');
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

