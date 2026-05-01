import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tenantStorage } from './tenant-context';

/**
 * Sets tenant context from request.user.organizationId for the duration of the request.
 * Skips context (runs with null) for /admin and /sales so Prisma middleware never injects org filter there.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const path = (request.path ?? request.url?.split('?')[0] ?? '') as string;
    const isAdminOrSales = path.startsWith('/admin') || path.startsWith('/sales');

    const ctx = isAdminOrSales
      ? null
      : request.user?.organizationId
        ? { organizationId: request.user.organizationId }
        : null;

    return new Observable((subscriber) => {
      tenantStorage.run(ctx, () => {
        next.handle().subscribe({
          next: (value) => subscriber.next(value),
          error: (err) => subscriber.error(err),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}
