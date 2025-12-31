import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  Param,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  Render,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  // ========================================
  // Traditional Authentication
  // ========================================

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user with email and password' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'User with this email already exists' })
  async register(@Body() registerDto: RegisterDto) {
    const tokens = await this.authService.register(registerDto);
    return {
      message: 'Registration successful',
      ...tokens,
    };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful, returns access and refresh tokens' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto) {
    const tokens = await this.authService.login(loginDto);
    return {
      message: 'Login successful',
      ...tokens,
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({ status: 200, description: 'New access token generated' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refreshTokens(@Body() refreshTokenDto: RefreshTokenDto) {
    const tokens = await this.authService.refreshTokens(refreshTokenDto.refreshToken);
    return {
      message: 'Token refreshed successfully',
      ...tokens,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(@CurrentUser('userId') userId: string) {
    await this.authService.logout(userId);
    return { message: 'Logged out successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Returns current user information' })
  async getProfile(@CurrentUser() user: any) {
    const { password, refreshToken, resetPasswordToken, ...safeUser } = user;
    return safeUser;
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 401, description: 'Current password is incorrect' })
  async changePassword(
    @CurrentUser('userId') userId: string,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(
      userId,
      changePasswordDto.currentPassword,
      changePasswordDto.newPassword,
    );
    return { message: 'Password changed successfully' };
  }

  // ========================================
  // Password Reset
  // ========================================

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset email' })
  @ApiResponse({ status: 200, description: 'If user exists, password reset email will be sent' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    await this.authService.forgotPassword(forgotPasswordDto.email);
    return {
      message: 'If an account exists with this email, you will receive a password reset link.',
    };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired reset token' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    await this.authService.resetPassword(resetPasswordDto.token, resetPasswordDto.newPassword);
    return { message: 'Password reset successfully' };
  }

  // ========================================
  // Google OAuth2
  // ========================================

  @Public()
  @Get('google')
  @ApiOperation({ summary: 'Initiate Google OAuth2 login' })
  @ApiResponse({ status: 302, description: 'Redirects to Google consent screen' })
  async googleAuth(@Res() res: Response) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const state = this.generateState();
    
    // In production, validate state parameter for CSRF protection
    res.redirect(
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${this.configService.get<string>('GOOGLE_CLIENT_ID')}&` +
      `redirect_uri=${this.configService.get<string>('GOOGLE_CALLBACK_URL')}&` +
      `response_type=code&` +
      `scope=openid%20email%20profile&` +
      `state=${state}&` +
      `access_type=offline&` +
      `prompt=consent`
    );
  }

  @Public()
  @Get('google/callback')
  @ApiOperation({ summary: 'Google OAuth2 callback' })
  @ApiResponse({ status: 200, description: 'Returns auth tokens and redirects to frontend' })
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    try {
      // Validate state parameter for CSRF protection
      if (!state) {
        throw new Error('Missing state parameter');
      }

      // In production, validate state against stored value
      // For now, we'll redirect to frontend with tokens
      const frontendUrl = this.configService.get<string>('FRONTEND_URL');
      
      // The Passport Google strategy will handle the code exchange
      // This endpoint is handled by the Passport strategy middleware
      res.redirect(`${frontendUrl}/auth/callback?strategy=google&code=${code}&state=${state}`);
    } catch (error) {
      const frontendUrl = this.configService.get<string>('FRONTEND_URL');
      res.redirect(`${frontendUrl}/auth/error?message=${encodeURIComponent(error.message)}`);
    }
  }

  // ========================================
  // GitHub OAuth2
  // ========================================

  @Public()
  @Get('github')
  @ApiOperation({ summary: 'Initiate GitHub OAuth2 login' })
  @ApiResponse({ status: 302, description: 'Redirects to GitHub consent screen' })
  async githubAuth(@Res() res: Response) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const state = this.generateState();

    res.redirect(
      `https://github.com/login/oauth/authorize?` +
      `client_id=${this.configService.get<string>('GITHUB_CLIENT_ID')}&` +
      `redirect_uri=${this.configService.get<string>('GITHUB_CALLBACK_URL')}&` +
      `scope=read:user%20user:email&` +
      `state=${state}`
    );
  }

  @Public()
  @Get('github/callback')
  @ApiOperation({ summary: 'GitHub OAuth2 callback' })
  @ApiOperation({ summary: 'GitHub OAuth2 callback' })
  @ApiResponse({ status: 200, description: 'Returns auth tokens and redirects to frontend' })
  async githubCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    try {
      if (!state) {
        throw new Error('Missing state parameter');
      }

      const frontendUrl = this.configService.get<string>('FRONTEND_URL');
      res.redirect(`${frontendUrl}/auth/callback?strategy=github&code=${code}&state=${state}`);
    } catch (error) {
      const frontendUrl = this.configService.get<string>('FRONTEND_URL');
      res.redirect(`${frontendUrl}/auth/error?message=${encodeURIComponent(error.message)}`);
    }
  }

  // ========================================
  // OAuth Token Exchange Endpoint
  // This is called from frontend after OAuth callback
  // ========================================

  @Public()
  @Post('oauth/token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange OAuth code for JWT tokens' })
  @ApiResponse({ status: 200, description: 'Returns JWT access and refresh tokens' })
  async exchangeOAuthToken(
    @Body() body: { strategy: string; code: string; state: string },
  ) {
    // This endpoint would be called by the frontend after receiving the OAuth code
    // The actual token exchange happens in the Passport strategies
    return {
      message: 'OAuth token exchange endpoint. Use the Passport strategies to complete authentication.',
      strategy: body.strategy,
    };
  }

  // ========================================
  // Helper Methods
  // ========================================

  private generateState(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }
}
