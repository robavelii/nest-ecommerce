import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, AuthProvider, Role } from '../../../database/entities/user.entity';
import { AuthService } from '../auth.service';
import { GoogleProfile } from '../interfaces/oauth-profile.interface';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
      accessType: 'offline',
      prompt: 'consent',
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    try {
      const googleProfile: GoogleProfile = {
        id: profile.id,
        email: profile.emails?.[0]?.value,
        displayName: profile.displayName,
        firstName: profile.name?.givenName,
        lastName: profile.name?.familyName,
        photos: profile.photos?.map(photo => ({
          value: photo.value,
        })),
      };

      if (!googleProfile.email) {
        throw new UnauthorizedException('Google account must have an email address');
      }

      // Find or create user
      let user = await this.userRepository.findOne({
        where: [
          { providerId: profile.id, authProvider: AuthProvider.GOOGLE },
          { email: googleProfile.email },
        ],
      });

      if (user) {
        // Update user info
        user.authProvider = AuthProvider.GOOGLE;
        user.providerId = profile.id;
        if (profile.photos?.[0]?.value && !user.avatar) {
          user.avatar = profile.photos[0].value;
        }
        await this.userRepository.save(user);
      } else {
        // Create new user
        const [firstName, ...lastNameParts] = googleProfile.displayName?.split(' ') || ['Google', 'User'];
        const lastName = lastNameParts.join(' ') || '';

        user = this.userRepository.create({
          email: googleProfile.email,
          firstName: firstName || 'Google',
          lastName: lastName || 'User',
          authProvider: AuthProvider.GOOGLE,
          providerId: profile.id,
          avatar: profile.photos?.[0]?.value,
          role: Role.CUSTOMER,
          isEmailVerified: true,
        });
        await this.userRepository.save(user);
      }

      done(null, user);
    } catch (error) {
      done(error as Error, undefined);
    }
  }
}
