import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { EmailService } from "../../src/common/email/email.service";

describe("EmailService", () => {
  let service: EmailService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, any> = {
        SMTP_HOST: "smtp.example.com",
        SMTP_PORT: 587,
        SMTP_USER: "test@example.com",
        SMTP_PASSWORD: "password",
        EMAIL_FROM: "noreply@example.com",
        FRONTEND_URL: "http://localhost:3000",
      };
      return config[key];
    }),
  };

  const mockTransporter = {
    sendMail: jest.fn().mockResolvedValue({ messageId: "test-message-id" }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);

    (service as any).transporter = mockTransporter;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("sendEmail", () => {
    it("should send email successfully", async () => {
      const emailOptions = {
        to: "recipient@example.com",
        subject: "Test Subject",
        html: "<p>Test HTML</p>",
      };

      await service.sendEmail(emailOptions);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: "noreply@example.com",
        to: "recipient@example.com",
        subject: "Test Subject",
        html: "<p>Test HTML</p>",
      });
    });

    it("should handle array of recipients", async () => {
      const emailOptions = {
        to: ["user1@example.com", "user2@example.com"],
        subject: "Test Subject",
        html: "<p>Test</p>",
      };

      await service.sendEmail(emailOptions);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: "noreply@example.com",
        to: "user1@example.com,user2@example.com",
        subject: "Test Subject",
        html: "<p>Test</p>",
      });
    });

    it("should throw error on send failure", async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error("SMTP Error"));

      const emailOptions = {
        to: "recipient@example.com",
        subject: "Test Subject",
        html: "<p>Test</p>",
      };

      await expect(service.sendEmail(emailOptions)).rejects.toThrow(
        "Failed to send email: SMTP Error",
      );
    });
  });

  describe("sendPasswordResetEmail", () => {
    it("should send password reset email", async () => {
      const resetToken = "reset-token-123";
      const name = "John Doe";

      await service.sendPasswordResetEmail(
        "user@example.com",
        resetToken,
        name,
      );

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: "noreply@example.com",
        to: "user@example.com",
        subject: "Password Reset Request",
        html: expect.stringContaining("reset-token-123"),
        html: expect.stringContaining("John Doe"),
      });
    });

    it("should include reset link in email", async () => {
      const resetToken = "reset-token-456";

      await service.sendPasswordResetEmail("user@example.com", resetToken);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        html: expect.stringContaining(
          "http://localhost:3000/auth/reset-password?token=reset-token-456",
        ),
      });
    });

    it("should handle missing name", async () => {
      const resetToken = "reset-token-789";

      await service.sendPasswordResetEmail("user@example.com", resetToken);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        html: expect.stringContaining("there"),
      });
    });
  });

  describe("sendWelcomeEmail", () => {
    it("should send welcome email", async () => {
      await service.sendWelcomeEmail("newuser@example.com", "Jane");

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: "noreply@example.com",
        to: "newuser@example.com",
        subject: "Welcome to Our Store!",
        html: expect.stringContaining("Jane"),
        html: expect.stringContaining("newuser@example.com"),
      });
    });
  });

  describe("sendOrderConfirmationEmail", () => {
    it("should send order confirmation email", async () => {
      await service.sendOrderConfirmationEmail(
        "customer@example.com",
        "ORD-12345",
        149.99,
      );

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: "noreply@example.com",
        to: "customer@example.com",
        subject: "Order Confirmation - ORD-12345",
        html: expect.stringContaining("ORD-12345"),
        html: expect.stringContaining("149.99"),
      });
    });
  });

  describe("sendPasswordChangedEmail", () => {
    it("should send password changed email", async () => {
      await service.sendPasswordChangedEmail("user@example.com", "John");

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: "noreply@example.com",
        to: "user@example.com",
        subject: "Password Changed Successfully",
        html: expect.stringContaining("John"),
        html: expect.stringContaining("successfully changed"),
      });
    });

    it("should handle missing name in password changed email", async () => {
      await service.sendPasswordChangedEmail("user@example.com");

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        html: expect.stringContaining("there"),
      });
    });
  });
});
