import { Global, Module } from '@nestjs/common';
import { LoggerServiceImpl } from './logger.service';

@Global()
@Module({
  providers: [LoggerServiceImpl],
  exports: [LoggerServiceImpl],
})
export class LoggerModule {}

