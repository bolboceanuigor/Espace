import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<{ path?: string; originalUrl?: string }>();
    const path = request?.path || request?.originalUrl || '';

    return next.handle().pipe(
      map((body) => {
        if (
          path === '/health' ||
          path === '/health/db' ||
          path === '/auth/login' ||
          path === '/api/auth/login' ||
          path === '/auth/me' ||
          path === '/api/auth/me'
        ) {
          return body;
        }
        if (
          body &&
          typeof body === 'object' &&
          ('data' in body || 'error' in body || 'meta' in body)
        ) {
          return body;
        }
        return { data: body };
      }),
    );
  }
}
