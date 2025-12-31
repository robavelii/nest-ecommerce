import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { Repository } from "typeorm";
import { getRepositoryToken } from "@nestjs/typeorm";
import { AuthService } from "../../src/modules/auth/auth.service";
import {
  User,
  Role,
  AuthProvider,
} from "../../src/database/entities/user.entity";
import { JwtService } from "@nestjs/jwt";
import { EmailService } from "../../src/common/email/email.service";
import { TestFactory } from "../factories/test.factory";
import * as bcrypt from "bcrypt";

describe("AuthService", () => {
  let service: AuthService;
  let userRepository: Repository<User>;
  let jwtService: JwtService;
  let emailService: EmailService;

  const mockConfigService: any = {
    get: jest.fn((key: string) => {
      const config: Record<string, any> = {
        JWT_SECRET: "test-secret-key-minimum-32-characters",
        JWT_ACCESS_EXPIRATION: "15m",
        JWT_REFRESH_EXPIRATION: "7d",
        JWT_RESET_TOKEN_EXPIRATION: "1h",
        FRONTEND_URL: "http://localhost:3000",
      };
      return config[key];
    }),
  };

  const mockEmailService: any = {
    sendPasswordResetEmail: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue("mock-jwt-token"),
            verify: jest
              .fn()
              .mockReturnValue({
                sub: "user-id",
                email: "test@example.com",
                role: Role.CUSTOMER,
              }),
          },
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: getRepositoryToken(User),
          useFactory: () => ({
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
          }),
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    jwtService = module.get<JwtService>(JwtService);
    emailService = module.get<EmailService>(EmailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("register", () => {
    it("should register a new user successfully", async () => {
      const userData = {
        email: "newuser@example.com",
        password: "SecurePass123!",
        firstName: "John",
        lastName: "Doe",
      };

      (userRepository.findOne as jest.Mock).mockResolvedValue(null);
      (userRepository.create as jest.Mock).mockReturnValue(userData);
      (userRepository.save as jest.Mock).mockResolvedValue({
        id: "user-123",
        ...userData,
        role: Role.CUSTOMER,
      });

      (jwtService.sign as jest.Mock)
        .mockReturnValueOnce("mock-access-token")
        .mockReturnValueOnce("mock-refresh-token");

      const result = await service.register(userData as any);

      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("refreshToken");
      expect(result).toHaveProperty("tokenType", "Bearer");
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: userData.email },
      });
      expect(userRepository.save).toHaveBeenCalled();
    });

    it("should throw ConflictException if user already exists", async () => {
      const userData = {
        email: "existing@example.com",
        password: "SecurePass123!",
        firstName: "John",
        lastName: "Doe",
      };

      (userRepository.findOne as jest.Mock).mockResolvedValue({
        id: "user-123",
      });

      await expect(service.register(userData as any)).rejects.toThrow(
        "User with this email already exists",
      );
    });
  });

  describe("login", () => {
    it("should login with valid credentials", async () => {
      const userData = {
        id: "user-123",
        email: "test@example.com",
        password: await bcrypt.hash("SecurePass123!", 12),
        firstName: "John",
        lastName: "Doe",
        role: Role.CUSTOMER,
        isActive: true,
      };

      (userRepository.findOne as jest.Mock).mockResolvedValue(userData);
      (userRepository.update as jest.Mock).mockResolvedValue(undefined);

      (jwtService.sign as jest.Mock)
        .mockReturnValueOnce("mock-access-token")
        .mockReturnValueOnce("mock-refresh-token");

      const loginDto = {
        email: "test@example.com",
        password: "SecurePass123!",
      };

      const result = await service.login(loginDto);

      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("refreshToken");
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: loginDto.email },
      });
      expect(userRepository.update).toHaveBeenCalled();
    });

    it("should throw UnauthorizedException with invalid email", async () => {
      (userRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.login({
          email: "wrong@example.com",
          password: "SecurePass123!",
        }),
      ).rejects.toThrow("Invalid credentials");
    });

    it("should throw UnauthorizedException with invalid password", async () => {
      const userData = {
        id: "user-123",
        email: "test@example.com",
        password: await bcrypt.hash("SecurePass123!", 12),
        isActive: true,
      };

      (userRepository.findOne as jest.Mock).mockResolvedValue(userData);

      await expect(
        service.login({ email: "test@example.com", password: "WrongPass123!" }),
      ).rejects.toThrow("Invalid credentials");
    });

    it("should throw UnauthorizedException for inactive user", async () => {
      const userData = {
        id: "user-123",
        email: "test@example.com",
        password: await bcrypt.hash("SecurePass123!", 12),
        isActive: false,
      };

      (userRepository.findOne as jest.Mock).mockResolvedValue(userData);

      await expect(
        service.login({
          email: "test@example.com",
          password: "SecurePass123!",
        }),
      ).rejects.toThrow("Account is deactivated");
    });
  });

  describe("refreshTokens", () => {
    it("should refresh tokens with valid refresh token", async () => {
      const hashedToken = await bcrypt.hash("valid-refresh-token", 12);
      const userData = {
        id: "user-123",
        email: "test@example.com",
        role: Role.CUSTOMER,
        refreshToken: hashedToken,
      };

      (userRepository.find as jest.Mock).mockResolvedValue([userData]);
      (userRepository.update as jest.Mock).mockResolvedValue(undefined);

      (jwtService.sign as jest.Mock)
        .mockReturnValueOnce("new-access-token")
        .mockReturnValueOnce("new-refresh-token");

      const result = await service.refreshTokens("valid-refresh-token");

      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("refreshToken");
      expect(userRepository.update).toHaveBeenCalled();
    });

    it("should throw UnauthorizedException with invalid refresh token", async () => {
      (userRepository.find as jest.Mock).mockResolvedValue([]);

      await expect(
        service.refreshTokens("invalid-refresh-token"),
      ).rejects.toThrow("Invalid refresh token");
    });
  });

  describe("logout", () => {
    it("should clear refresh token", async () => {
      (userRepository.update as jest.Mock).mockResolvedValue(undefined);

      await service.logout("user-123");

      expect(userRepository.update).toHaveBeenCalledWith("user-123", {
        refreshToken: "",
      });
    });
  });

  describe("forgotPassword", () => {
    it("should send password reset email for existing user", async () => {
      const userData = {
        id: "user-123",
        email: "test@example.com",
        firstName: "John",
      };

      (userRepository.findOne as jest.Mock).mockResolvedValue(userData);
      (userRepository.save as jest.Mock).mockResolvedValue(undefined);

      await service.forgotPassword("test@example.com");

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: "test@example.com" },
      });
      expect(jwtService.sign).toHaveBeenCalled();
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalled();
    });

    it("should not reveal if user exists", async () => {
      (userRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.forgotPassword("nonexistent@example.com"),
      ).resolves.not.toThrow();
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  describe("resetPassword", () => {
    it("should reset password with valid token", async () => {
      const userData = {
        id: "user-123",
        email: "test@example.com",
        resetPasswordToken: "valid-token",
        resetPasswordExpires: new Date(Date.now() + 3600000),
      };

      (userRepository.findOne as jest.Mock)
        .mockResolvedValueOnce(userData)
        .mockResolvedValueOnce(userData);
      (userRepository.save as jest.Mock).mockResolvedValue(undefined);

      await service.resetPassword("valid-token", "NewSecurePass456!");

      expect(userRepository.save).toHaveBeenCalled();
    });

    it("should throw BadRequestException with invalid token", async () => {
      (userRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.resetPassword("invalid-token", "NewSecurePass456!"),
      ).rejects.toThrow("Invalid or expired reset token");
    });
  });

  describe("changePassword", () => {
    it("should change password with valid current password", async () => {
      const userData = {
        id: "user-123",
        email: "test@example.com",
        password: await bcrypt.hash("SecurePass123!", 12),
      };

      (userRepository.findOne as jest.Mock).mockResolvedValue(userData);
      (userRepository.save as jest.Mock).mockResolvedValue(undefined);

      await service.changePassword(
        "user-123",
        "SecurePass123!",
        "NewSecurePass456!",
      );

      expect(userRepository.save).toHaveBeenCalled();
    });

    it("should throw UnauthorizedException with invalid current password", async () => {
      const userData = {
        id: "user-123",
        email: "test@example.com",
        password: await bcrypt.hash("SecurePass123!", 12),
      };

      (userRepository.findOne as jest.Mock).mockResolvedValue(userData);

      await expect(
        service.changePassword(
          "user-123",
          "WrongPass123!",
          "NewSecurePass456!",
        ),
      ).rejects.toThrow("Current password is incorrect");
    });
  });
});
