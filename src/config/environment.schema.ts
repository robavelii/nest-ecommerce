import * as Joi from "joi";

export const validationSchema = Joi.object({
  // Application
  NODE_ENV: Joi.string()
    .valid("development", "production", "test", "staging")
    .default("development"),
  PORT: Joi.number().port().default(3000),
  API_PREFIX: Joi.string().default("api/v1"),

  // Database
  DB_HOST: Joi.string().default("localhost"),
  DB_PORT: Joi.number().port().default(5432),
  DB_USERNAME: Joi.string().default("postgres"),
  DB_PASSWORD: Joi.string().default("postgres"),
  DB_NAME: Joi.string().default("ecommerce"),
  DB_SYNCHRONIZE: Joi.boolean().default(true),
  DB_LOGGING: Joi.boolean().default(false),

  // Redis
  REDIS_HOST: Joi.string().default("localhost"),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().allow("").optional(),

  // JWT - Required in production, has default in development
  JWT_SECRET: Joi.string()
    .min(32)
    .default("development-jwt-secret-key-change-in-production"),
  JWT_ACCESS_EXPIRATION: Joi.string().default("15m"),
  JWT_REFRESH_EXPIRATION: Joi.string().default("7d"),
  JWT_RESET_TOKEN_EXPIRATION: Joi.string().default("1h"),

  // Rate Limiting
  THROTTLE_TTL: Joi.number().min(1).default(60),
  THROTTLE_LIMIT: Joi.number().min(1).default(100),

  // Google OAuth
  GOOGLE_CLIENT_ID: Joi.string().optional(),
  GOOGLE_CLIENT_SECRET: Joi.string().optional(),
  GOOGLE_CALLBACK_URL: Joi.string().uri().optional(),

  // GitHub OAuth
  GITHUB_CLIENT_ID: Joi.string().optional(),
  GITHUB_CLIENT_SECRET: Joi.string().optional(),
  GITHUB_CALLBACK_URL: Joi.string().uri().optional(),

  // Stripe
  STRIPE_SECRET_KEY: Joi.string().optional(),
  STRIPE_WEBHOOK_SECRET: Joi.string().optional(),
  STRIPE_PUBLISHABLE_KEY: Joi.string().optional(),

  // Email
  SMTP_HOST: Joi.string().default("smtp.gmail.com"),
  SMTP_PORT: Joi.number().port().default(587),
  SMTP_USER: Joi.string().email().optional(),
  SMTP_PASSWORD: Joi.string().optional(),
  EMAIL_FROM: Joi.string().email().optional(),

  // File Upload
  MAX_FILE_SIZE: Joi.number().default(5242880),
  UPLOAD_DEST: Joi.string().default("./uploads"),

  // Order Configuration
  TAX_RATE: Joi.number().min(0).max(1).default(0.08),
  SHIPPING_COST: Joi.number().min(0).default(10),
  FREE_SHIPPING_THRESHOLD: Joi.number().min(0).default(100),

  // S3/MinIO Configuration
  STORAGE_TYPE: Joi.string().valid("local", "s3", "minio").default("local"),
  AWS_REGION: Joi.string().default("us-east-1"),
  AWS_ACCESS_KEY_ID: Joi.string().optional(),
  AWS_SECRET_ACCESS_KEY: Joi.string().optional(),
  AWS_S3_BUCKET: Joi.string().optional(),
  AWS_S3_ENDPOINT: Joi.string().optional(),
  AWS_S3_FORCE_PATH_STYLE: Joi.boolean().default(false),

  // CORS
  CORS_ORIGIN: Joi.string().default(
    "http://localhost:3000,http://localhost:5173",
  ),

  // Frontend
  FRONTEND_URL: Joi.string().uri().default("http://localhost:5173"),
});

export type EnvironmentVariables = {
  NODE_ENV?: string;
  PORT?: number;
  API_PREFIX?: string;
  DB_HOST?: string;
  DB_PORT?: number;
  DB_USERNAME?: string;
  DB_PASSWORD?: string;
  DB_NAME?: string;
  DB_SYNCHRONIZE?: boolean;
  DB_LOGGING?: boolean;
  REDIS_HOST?: string;
  REDIS_PORT?: number;
  REDIS_PASSWORD?: string;
  JWT_SECRET: string;
  JWT_ACCESS_EXPIRATION?: string;
  JWT_REFRESH_EXPIRATION?: string;
  JWT_RESET_TOKEN_EXPIRATION?: string;
  THROTTLE_TTL?: number;
  THROTTLE_LIMIT?: number;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_CALLBACK_URL?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GITHUB_CALLBACK_URL?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PUBLISHABLE_KEY?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_USER?: string;
  SMTP_PASSWORD?: string;
  EMAIL_FROM?: string;
  MAX_FILE_SIZE?: number;
  UPLOAD_DEST?: string;
  STORAGE_TYPE?: string;
  AWS_REGION?: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  AWS_S3_BUCKET?: string;
  AWS_S3_ENDPOINT?: string;
  AWS_S3_FORCE_PATH_STYLE?: boolean;
  CORS_ORIGIN?: string;
  FRONTEND_URL?: string;
  TAX_RATE?: number;
  SHIPPING_COST?: number;
  FREE_SHIPPING_THRESHOLD?: number;
};
