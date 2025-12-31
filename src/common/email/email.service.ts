import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
}

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>("SMTP_HOST", "smtp.gmail.com"),
      port: this.configService.get<number>("SMTP_PORT", 587),
      secure: false,
      auth: {
        user: this.configService.get<string>("SMTP_USER"),
        pass: this.configService.get<string>("SMTP_PASSWORD"),
      },
    });
  }

  async sendEmail(options: SendEmailOptions): Promise<void> {
    const from = this.configService.get<string>(
      "EMAIL_FROM",
      "noreply@yourdomain.com",
    );

    try {
      await this.transporter.sendMail({
        from,
        to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });
    } catch (error) {
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  async sendPasswordResetEmail(
    email: string,
    resetToken: string,
    name?: string,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>(
      "FRONTEND_URL",
      "http://localhost:5173",
    );
    const resetLink = `${frontendUrl}/auth/reset-password?token=${resetToken}`;
    const subject = "Password Reset Request";

    const html = this.getPasswordResetTemplate(name, resetLink);

    await this.sendEmail({
      to: email,
      subject,
      html,
    });
  }

  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    const subject = "Welcome to Our Store!";
    const html = this.getWelcomeTemplate(name, email);

    await this.sendEmail({
      to: email,
      subject,
      html,
    });
  }

  async sendOrderConfirmationEmail(
    email: string,
    orderNumber: string,
    total: number,
  ): Promise<void> {
    const subject = `Order Confirmation - ${orderNumber}`;
    const html = this.getOrderConfirmationTemplate(orderNumber, total);

    await this.sendEmail({
      to: email,
      subject,
      html,
    });
  }

  async sendPasswordChangedEmail(email: string, name?: string): Promise<void> {
    const subject = "Password Changed Successfully";
    const html = this.getPasswordChangedTemplate(name);

    await this.sendEmail({
      to: email,
      subject,
      html,
    });
  }

  private getPasswordResetTemplate(
    name: string | undefined,
    resetLink: string,
  ): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Password Reset Request</h2>
        <p>Hello ${name || "there"},</p>
        <p>We received a request to reset your password. Click the link below to reset it:</p>
        <p>
          <a href="${resetLink}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Reset Password</a>
        </p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      </div>
    `;
  }

  private getWelcomeTemplate(name: string, email: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome to Our Store!</h2>
        <p>Hello ${name},</p>
        <p>Thank you for registering with us. We're excited to have you on board!</p>
        <p>Your account email: ${email}</p>
        <p>If you have any questions, feel free to reach out to our support team.</p>
        <p>Happy shopping!</p>
      </div>
    `;
  }

  private getOrderConfirmationTemplate(
    orderNumber: string,
    total: number,
  ): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Order Confirmed!</h2>
        <p>Thank you for your order.</p>
        <p><strong>Order Number:</strong> ${orderNumber}</p>
        <p><strong>Total Amount:</strong> $${total.toFixed(2)}</p>
        <p>We'll send you another email when your order ships.</p>
      </div>
    `;
  }

  private getPasswordChangedTemplate(name: string | undefined): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Password Changed</h2>
        <p>Hello ${name || "there"},</p>
        <p>Your password has been successfully changed.</p>
        <p>If you didn't make this change, please contact our support team immediately.</p>
      </div>
    `;
  }
}
