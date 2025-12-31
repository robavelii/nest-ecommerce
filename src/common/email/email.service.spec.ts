import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './email.service';

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        {
          provide: EmailService,
          useFactory: () => {
            return new EmailService({
              get: jest.fn((key: string) => {
                const env: Record<string, any> = {
                  SMTP_HOST: 'smtp.test.com',
                  SMTP_PORT: 587,
                  SMTP_USER: 'test@test.com',
                  SMTP_PASSWORD: 'password',
                  EMAIL_FROM: 'noreply@test.com',
                  FRONTEND_URL: 'http://localhost:3000',
                };
                return env[key];
              }),
            } as any,
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
