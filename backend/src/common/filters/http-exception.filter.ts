import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  private getErrorCode(status: number, message: string | string[]): string {
    if (status === HttpStatus.BAD_REQUEST) return 'VALIDATION_ERROR';
    if (status === HttpStatus.UNAUTHORIZED) return 'UNAUTHORIZED';
    if (status === HttpStatus.FORBIDDEN) return 'FORBIDDEN';
    if (status === HttpStatus.NOT_FOUND) return 'NOT_FOUND';
    if (status === HttpStatus.TOO_MANY_REQUESTS) return 'TOO_MANY_REQUESTS';
    if (status === HttpStatus.CONFLICT) {
      const text = Array.isArray(message) ? message.join(' ').toLowerCase() : String(message).toLowerCase();
      if (text.includes('overlap')) return 'CONFLICT_OVERLAP';
      return 'CONFLICT';
    }
    if (status >= 500) return 'INTERNAL_ERROR';
    return 'REQUEST_ERROR';
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'A apărut o eroare. Încearcă din nou.';
    let details: unknown = null;
    let explicitCode: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const typed = exceptionResponse as {
          message?: string | string[];
          details?: unknown;
          code?: string;
        };
        message = typed.message ?? exception.message;
        details = typed.details ?? null;
        explicitCode = typed.code;
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      if (exception.name === 'UnauthorizedError') {
        status = HttpStatus.UNAUTHORIZED;
      }
    }

    const isProduction = process.env.NODE_ENV === 'production';
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
      if (isProduction) {
        message = 'A apărut o eroare. Încearcă din nou.';
        details = null;
      }
    }

    if (status === HttpStatus.TOO_MANY_REQUESTS) {
      message = 'Prea multe cereri. Încearcă din nou mai târziu.';
    }

    response.status(status).json({
      data: null,
      error: {
        code: explicitCode || this.getErrorCode(status, message),
        message,
        details,
      },
    });
  }
}
