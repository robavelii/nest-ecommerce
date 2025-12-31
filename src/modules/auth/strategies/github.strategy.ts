import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, AuthProvider, Role } from '../../../database/entities/user.entity';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    super({
      clientID: configService.get<string>('GITHUB_CLIENT_ID'),
      clientSecret: configService.get<string>('GITHUB_CLIENT_SECRET'),
      callbackURL: configService.get<string>('GITHUB_CALLBACK_URL'),
      scope: ['user:email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: (error: Error | null, user?: User) => void,
  ): Promise<void> {
    try {
      const { id, username, emails, photos, displayName } = profile;
      const email = emails?.[0]?.value;

      if (!email) {
        throw new UnauthorizedException(
          'GitHub email is not public. Please make your email public in GitHub settings.',
        );
      }

      // Find or create user
      let user = await this.userRepository.findOne({
        where: [
          { providerId: String(id), authProvider: AuthProvider.GITHUB },
          { email },
        ],
      });

      if (user) {
        user.authProvider = AuthProvider.GITHUB;
        user.providerId = String(id);
        if (photos?.[0]?.value && !user.avatar) {
          user.avatar = photos[0].value;
        }
        await this.userRepository.save(user);
      } else {
        // Create new user
        const nameParts = displayName?.split(' ') || [username, ''];
        const firstName = nameParts[0] || username;
        const lastName = nameParts.slice(1).join(' ') || '';

        user = this.userRepository.create({
          email,
          firstName,
          lastName,
          authProvider: AuthProvider.GITHUB,
          providerId: String(id),
          avatar: photos?.[0]?.value,
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
