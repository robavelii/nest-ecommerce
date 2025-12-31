import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD, APP_PIPE, APP_FILTER } from "@nestjs/core";
import { ThrottlerGuard } from "@nestjs/throttler";
import { ValidationPipe } from "@nestjs/common";
import { LoggerModule } from "./common/logger/logger.module";
import { LoggerServiceImpl } from "./common/logger/logger.service";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { MiddlewareModule } from "./common/middleware/middleware.module";
import { AuditModule } from "./common/audit/audit.module";
import { validationSchema } from "./config/environment.schema";
import { dataSourceOptions } from "./database/data-source";
import { AdminModule } from "./modules/admin/admin.module";
import { AuthModule } from "./modules/auth/auth.module";
import { CartModule } from "./modules/cart/cart.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { ProductsModule } from "./modules/products/products.module";
import { ReviewsModule } from "./modules/reviews/reviews.module";
import { UploadsModule } from "./modules/uploads/uploads.module";
import { UsersModule } from "./modules/users/users.module";
import { CouponsModule } from "./modules/coupons/coupons.module";

@Module({
  imports: [
    // Configuration with Joi validation
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema,
      validationOptions: {
        abortEarly: true,
      },
      cache: true,
      expandVariables: true,
    }),

    // Global Logger Module
    LoggerModule,

    // Global Middleware Module
    MiddlewareModule,

    // Global Audit Module
    AuditModule,

    // Rate Limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => [
        {
          name: "default",
          ttl: configService.get("THROTTLE_TTL", 60000),
          limit: configService.get("THROTTLE_LIMIT", 10),
        },
      ],
      inject: [ConfigService],
    }),

    // TypeORM Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: () => dataSourceOptions,
      inject: [ConfigService],
    }),

    // Feature Modules
    AuthModule,
    UsersModule,
    CategoriesModule,
    ProductsModule,
    CartModule,
    OrdersModule,
    PaymentsModule,
    ReviewsModule,
    UploadsModule,
    AdminModule,
    CouponsModule,
  ],
  providers: [
    // Global Validation Pipe
    {
      provide: APP_PIPE,
      useFactory: (configService: ConfigService) =>
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
          transformOptions: {
            enableImplicitConversion: true,
          },
          validationError: {
            target: false,
            value: false,
          },
        }),
      inject: [ConfigService],
    },

    // Global Exception Filter
    {
      provide: APP_FILTER,
      useFactory: (logger: LoggerServiceImpl) =>
        new AllExceptionsFilter(logger),
      inject: [LoggerServiceImpl],
    },

    // Rate Limiting Guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
