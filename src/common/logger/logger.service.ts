import { Injectable, LoggerService } from '@nestjs/common';
import * as winston from 'winston';

@Injectable()
export class LoggerServiceImpl implements LoggerService {
  private logger: winston.Logger;

  constructor() {
    const { combine, timestamp, json, printf, colorize } = winston.format;

    const jsonFormat = combine(
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      json(),
    );

    const consoleFormat = printf(({ level, message, timestamp, context, traceId }) => {
      return `${timestamp} [${level}] ${context ? `[${context}]` : ''}: ${message}${traceId ? ` [trace: ${traceId}]` : ''}`;
    });

    this.logger = winston.createLogger({
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      format: jsonFormat,
      defaultMeta: { service: 'ecommerce-api' },
      transports: [
        new winston.transports.Console({
          format: process.env.NODE_ENV === 'production'
            ? jsonFormat
            : combine(colorize(), consoleFormat),
        }),
      ],
    });
  }

  log(message: string, context?: string, traceId?: string) {
    this.logger.info(message, { context, traceId });
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error(message, { trace, context });
  }

  warn(message: string, context?: string) {
    this.logger.warn(message, { context });
  }

  debug(message: string, context?: string) {
    this.logger.debug(message, { context });
  }

  verbose(message: string, context?: string) {
    this.logger.verbose(message, { context });
  }
}
