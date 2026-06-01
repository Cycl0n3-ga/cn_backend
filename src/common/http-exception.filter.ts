import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { getRequestId } from './request-context.js';

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalHttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;
    const message = this.extractMessage(exceptionResponse, exception);
    const requestId = getRequestId();

    if (status >= 500) {
      const errorMessage =
        exception instanceof Error ? exception.message : 'Unknown error.';
      this.logger.error(
        JSON.stringify({
          event: 'http_error',
          requestId,
          method: request.method,
          path: request.originalUrl,
          statusCode: status,
          message: errorMessage,
        }),
      );
    }

    response.status(status).json({
      statusCode: status,
      error:
        exception instanceof HttpException
          ? exception.name.replace('Exception', '')
          : 'InternalServerError',
      message,
      path: request.originalUrl,
      requestId,
      timestamp: new Date().toISOString(),
    });
  }

  private extractMessage(response: unknown, exception: unknown) {
    if (typeof response === 'string') {
      return response;
    }
    if (response && typeof response === 'object' && 'message' in response) {
      return (response as { message: unknown }).message;
    }
    if (exception instanceof Error) {
      return exception.message;
    }
    return 'Internal server error.';
  }
}
