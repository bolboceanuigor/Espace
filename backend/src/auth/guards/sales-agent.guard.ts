import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Role } from '@prisma/client';

@Injectable()
export class SalesAgentGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    if (user?.role !== Role.ADMIN && user?.role !== Role.ADMIN && user?.role !== Role.SUPERADMIN) {
      throw new ForbiddenException('Sales agent access required');
    }
    return true;
  }
}
