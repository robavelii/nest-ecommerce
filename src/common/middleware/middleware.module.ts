import { Module, MiddlewareConsumer, NestModule } from "@nestjs/common";
import { RequestIdMiddleware } from "./request-id.middleware";

@Module({})
export class MiddlewareModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes("*");
  }
}
