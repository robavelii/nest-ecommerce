/* eslint-disable @typescript-eslint/no-unused-vars */
import { Module } from '@nestjs/common';
import * as path from 'path';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { I18nModule } from 'nestjs-i18n/dist/i18n.module';
import { HeaderResolver } from 'nestjs-i18n';
import { DataSource } from 'typeorm';
import { UsersModule } from './modules/users/users.module';
import { FilesModule } from './files/files.module';
import { AuthModule } from './auth/auth.module';
import databaseConfig from './config/database.config';
import authConfig from './config/auth.config';
import appConfig from './config/app.config';
import mailConfig from './config/mail.config';
import fileConfig from './config/file.config';
import facebookConfig from './config/facebook.config';
import googleConfig from './config/google.config';
import twitterConfig from './config/twitter.config';
import appleConfig from './config/apple.config';
import { AuthAppleModule } from './auth-social/auth-apple/auth-apple.module';
import { AuthFacebookModule } from './auth-social/auth-facebook/auth-facebook.module';
import { AuthGoogleModule } from './auth-social/auth-google/auth-google.module';
import { AuthTwitterModule } from './auth-social/auth-twitter/auth-twitter.module';
import { TypeOrmConfigService } from './database/typeorm-config.service';
import { MailConfigService } from './mail/mail-config.service';
import { ForgotModule } from './forgot/forgot.module';
import { MailModule } from './mail/mail.module';
import { HomeModule } from './home/home.module';
import { ProductsModule } from './modules/products/products.module';
import { OrdersModule } from './modules/orders/orders.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        databaseConfig,
        authConfig,
        appConfig,
        mailConfig,
        fileConfig,
        // facebookConfig,
        // googleConfig,
        // twitterConfig,
        // appleConfig,
      ],
      envFilePath: ['.env'],
    }),
    TypeOrmModule.forRootAsync({
      useClass: TypeOrmConfigService,
      dataSourceFactory: async (options) => {
        const dataSource = await new DataSource(options).initialize();
        return dataSource;
      },
    }),
    MailerModule.forRootAsync({
      useClass: MailConfigService,
    }),
    I18nModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        fallbackLanguage: configService.get('app.fallbackLanguage'),
        loaderOptions: { path: path.join(__dirname, '/i18n/'), watch: true },
      }),
      resolvers: [
        {
          use: HeaderResolver,
          useFactory: (configService: ConfigService) => [
            configService.get('app.headerLanguage'),
          ],
          inject: [ConfigService],
        },
      ],
      imports: [ConfigModule],
      inject: [ConfigService],
    }),
    UsersModule,
    FilesModule,
    AuthModule,
    // AuthFacebookModule,
    // AuthGoogleModule,
    // AuthTwitterModule,
    // AuthAppleModule,
    ForgotModule,
    MailModule,
    HomeModule,
    OrdersModule,
    ProductsModule,
    OrdersModule,
  ],
})
export class AppModule {}
