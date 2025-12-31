import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, MoreThan } from "typeorm";
import * as bcrypt from "bcrypt";
import { User, AuthProvider, Role } from "../../database/entities/user.entity";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { LoggerServiceImpl as CustomLogger } from "../../common/logger/logger.service";
import {
  GoogleProfile,
  GithubProfile,
} from "./interfaces/oauth-profile.interface";
import { EmailService } from "../../common/email/email.service";

interface TokenPayload {
  sub: string;
  email: string;
  role: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly logger: CustomLogger,
    private readonly emailService: EmailService,
  ) {}

  // ========================================
  // Traditional Authentication
  // ========================================

  async register(registerDto: RegisterDto): Promise<AuthTokens> {
    const existingUser = await this.userRepository.findOne({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException("User with this email already exists");
    }

    const user = this.userRepository.create({
      ...registerDto,
      role: Role.CUSTOMER,
      authProvider: AuthProvider.LOCAL,
    });

    await this.userRepository.save(user);

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    this.logger.log(`User registered: ${user.email}`, "AuthService");

    return tokens;
  }

  async login(loginDto: LoginDto): Promise<AuthTokens> {
    const user = await this.userRepository.findOne({
      where: { email: loginDto.email },
    });

    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    if (!user.password) {
      throw new UnauthorizedException("Please login with your OAuth provider");
    }

    if (!user.isActive) {
      throw new UnauthorizedException("Account is deactivated");
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    await this.updateLastLogin(user.id);

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    this.logger.log(`User logged in: ${user.email}`, "AuthService");

    return tokens;
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    const users = await this.userRepository.find();
    const user = users.find(
      (u) => u.refreshToken && bcrypt.compareSync(refreshToken, u.refreshToken),
    );

    if (!user || !user.refreshToken) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    // Invalidate old refresh token
    await this.userRepository.update(user.id, { refreshToken: "" });

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  async logout(userId: string): Promise<void> {
    await this.userRepository.update(userId, { refreshToken: "" });
    this.logger.log(`User logged out: ${userId}`, "AuthService");
  }

  // ========================================
  // OAuth2 Authentication
  // ========================================

  async validateGoogleUser(profile: GoogleProfile): Promise<User> {
    const { id, email, displayName, photos } = profile;

    if (!email) {
      throw new BadRequestException("Google account must have an email");
    }

    let user = await this.userRepository.findOne({
      where: [{ providerId: id, authProvider: AuthProvider.GOOGLE }, { email }],
    });

    if (user) {
      // Update provider info if user exists
      if (user.authProvider !== AuthProvider.GOOGLE) {
        user.authProvider = AuthProvider.GOOGLE;
        user.providerId = id;
      }
      if (!user.avatar && photos?.[0]?.value) {
        user.avatar = photos[0].value;
      }
      await this.userRepository.save(user);
    } else {
      // Create new user
      const [firstName, ...lastNameParts] = displayName?.split(" ") || ["", ""];
      const lastName = lastNameParts.join(" ") || firstName;

      user = this.userRepository.create({
        email,
        firstName: firstName || "Google",
        lastName: lastName || "User",
        authProvider: AuthProvider.GOOGLE,
        providerId: id,
        avatar: photos?.[0]?.value,
        role: Role.CUSTOMER,
        isEmailVerified: true,
      });

      await this.userRepository.save(user);
      this.logger.log(`Google user created: ${email}`, "AuthService");
    }

    return user;
  }

  async validateGithubUser(profile: GithubProfile): Promise<User> {
    const { id, username, emails, photos, displayName } = profile;
    const email = emails?.[0]?.value;

    // GitHub might not provide email in profile, handle accordingly
    if (!email) {
      throw new BadRequestException(
        "GitHub account email is not public. Please make your email public or use another login method.",
      );
    }

    let user = await this.userRepository.findOne({
      where: [
        { providerId: String(id), authProvider: AuthProvider.GITHUB },
        { email },
      ],
    });

    if (user) {
      if (user.authProvider !== AuthProvider.GITHUB) {
        user.authProvider = AuthProvider.GITHUB;
        user.providerId = String(id);
      }
      if (!user.avatar && photos?.[0]?.value) {
        user.avatar = photos[0].value;
      }
      await this.userRepository.save(user);
    } else {
      const nameParts = displayName?.split(" ") || [username, ""];
      const firstName = nameParts[0] || username;
      const lastName = nameParts.slice(1).join(" ") || "";

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
      this.logger.log(`GitHub user created: ${email}`, "AuthService");
    }

    return user;
  }

  async handleOAuthLogin(user: User): Promise<AuthTokens> {
    await this.updateLastLogin(user.id);

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    this.logger.log(`OAuth user logged in: ${user.email}`, "AuthService");

    return tokens;
  }

  // ========================================
  // Password Management
  // ========================================

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user || !user.password) {
      throw new BadRequestException(
        "Cannot change password for OAuth accounts",
      );
    }

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException("Current password is incorrect");
    }

    user.password = newPassword;
    await this.userRepository.save(user);

    this.logger.log(`Password changed for user: ${user.email}`, "AuthService");
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (!user) {
      // Don't reveal if user exists
      this.logger.log(
        `Password reset requested for non-existent email: ${email}`,
        "AuthService",
      );
      return;
    }

    const resetToken = this.jwtService.sign(
      { sub: user.id, type: "reset" },
      {
        expiresIn: this.configService.get<string>("JWT_RESET_TOKEN_EXPIRATION"),
      },
    );

    const resetExpires = new Date();
    resetExpires.setHours(resetExpires.getHours() + 1);

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetExpires;
    await this.userRepository.save(user);

    await this.emailService.sendPasswordResetEmail(
      email,
      resetToken,
      user.firstName,
    );
    this.logger.log(`Password reset email sent to: ${email}`, "AuthService");
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: MoreThan(new Date()),
      },
    });

    if (!user) {
      throw new BadRequestException("Invalid or expired reset token");
    }

    user.password = newPassword;
    user.resetPasswordToken = "";
    user.resetPasswordExpires = null as any;
    await this.userRepository.save(user);

    this.logger.log(
      `Password reset completed for: ${user.email}`,
      "AuthService",
    );
  }

  // ========================================
  // Private Helper Methods
  // ========================================

  private async generateTokens(
    userId: string,
    email: string,
    role: string,
  ): Promise<AuthTokens> {
    const payload: TokenPayload = { sub: userId, email, role };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>("JWT_REFRESH_EXPIRATION"),
    });

    return {
      accessToken,
      refreshToken,
      tokenType: "Bearer",
      expiresIn: this.parseExpiresIn(
        this.configService.get<string>("JWT_ACCESS_EXPIRATION") || "15m",
      ),
    };
  }

  private async saveRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const hashedToken = await bcrypt.hash(refreshToken, 12);
    await this.userRepository.update(userId, { refreshToken: hashedToken });
  }

  private async updateLastLogin(userId: string): Promise<void> {
    await this.userRepository.update(userId, { lastLoginAt: new Date() });
  }

  private parseExpiresIn(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([mhd])$/);
    if (!match) return 3600;

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case "m":
        return value * 60;
      case "h":
        return value * 3600;
      case "d":
        return value * 86400;
      default:
        return 3600;
    }
  }
}
