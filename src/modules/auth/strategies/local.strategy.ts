import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      usernameField: 'email',
    });
  }

  async validate(email: string, password: string) {
    // This method is used by Passport for local authentication
    // For our implementation, we use the authService.login directly
    // This is a fallback for any passport-local usage
    throw new UnauthorizedException('Use /auth/login endpoint for email/password authentication');
  }
}
