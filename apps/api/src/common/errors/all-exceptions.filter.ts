import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { AppError } from './app-error.js';
import type { ErrorCode } from './error-codes.js';
import type { ErrorResponse } from './error-response.js';

const HTTP_STATUS_CODES: Record<number, ErrorCode> = {
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const body = this.toResponse(exception);
    response.status(body.statusCode).json(body);
  }

  private toResponse(exception: unknown): ErrorResponse {
    if (exception instanceof AppError) {
      return {
        statusCode: exception.statusCode,
        code: exception.code,
        message: exception.message,
        ...(exception.details && { details: exception.details }),
      };
    }

    // Framework errors (unknown route, malformed JSON, ...). Their messages are not exposed.
    if (exception instanceof HttpException && exception.getStatus() < 500) {
      const statusCode = exception.getStatus();
      return {
        statusCode,
        code: HTTP_STATUS_CODES[statusCode] ?? 'BAD_REQUEST',
        message: statusCode === 404 ? 'Resource not found' : 'Bad request',
      };
    }

    // Detail goes to the log only, never to the client.
    this.logger.error(
      exception instanceof Error ? exception.message : 'Unknown error',
      exception instanceof Error ? exception.stack : undefined,
    );
    return { statusCode: 500, code: 'INTERNAL_ERROR', message: 'Internal server error' };
  }
}
