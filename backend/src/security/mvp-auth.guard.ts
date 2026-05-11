import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ResidentAccountStatus, ResidentPortalAccessStatus, Role } from '@prisma/client';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

export type MvpUser = {
  id: string;
  sub: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: Role;
  organizationId: string;
};

function extractBearerToken(authorization?: string) {
  if (!authorization) return '';
  return authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : '';
}

function normalizeRole(role: Role | string) {
  const value = String(role).toUpperCase();
  return value === 'SUPER_ADMIN' ? 'SUPERADMIN' : value;
}

@Injectable()
export class MvpAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = extractBearerToken(request.headers?.authorization);
    if (!token) {
      throw new UnauthorizedException({
        code: 'AUTH_REQUIRED',
        message: 'Trebuie să te autentifici.',
      });
    }

    try {
      const payload = await this.jwtService.verifyAsync<{ sub?: string; userId?: string }>(token);
      const userId = payload.userId || payload.sub;
      if (!userId) throw new Error('Missing subject');

      const user = await this.prisma.user.findFirst({
        where: {
          id: userId,
          isActive: true,
          deletedAt: null,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          organizationId: true,
        },
      });

      if (!user) {
        throw new UnauthorizedException({
          code: 'SESSION_EXPIRED',
          message: 'Sesiunea a expirat. Te rugăm să te autentifici din nou.',
        });
      }

      if (user.role === Role.RESIDENT) {
        const residentProfile = await this.prisma.residentProfile.findFirst({
          where: {
            userId: user.id,
            organizationId: user.organizationId,
          },
          select: {
            id: true,
            apartmentId: true,
            accountStatus: true,
            portalAccessStatus: true,
            _count: { select: { apartmentResidents: true } },
          },
        });
        if (!residentProfile) {
          throw new ForbiddenException({
            code: 'RESIDENT_PORTAL_NOT_LINKED',
            message: 'Contul tău nu este încă legat de un locatar din asociație.',
          });
        }
        const explicitStatus = residentProfile.portalAccessStatus;
        if (explicitStatus === ResidentPortalAccessStatus.SUSPENDED) {
          throw new ForbiddenException({
            code: 'RESIDENT_PORTAL_ACCESS_SUSPENDED',
            message: 'Accesul la portal este suspendat. Contactează administratorul asociației.',
          });
        }
        if (explicitStatus === ResidentPortalAccessStatus.REVOKED) {
          throw new ForbiddenException({
            code: 'RESIDENT_PORTAL_ACCESS_REVOKED',
            message: 'Accesul la portal a fost revocat. Contactează administratorul asociației.',
          });
        }
        if (
          explicitStatus === ResidentPortalAccessStatus.NO_ACCESS ||
          explicitStatus === ResidentPortalAccessStatus.INVITED ||
          (!explicitStatus && residentProfile.accountStatus !== ResidentAccountStatus.CREATED)
        ) {
          throw new ForbiddenException({
            code: 'RESIDENT_PORTAL_ACCESS_NOT_ACTIVE',
            message: 'Accesul la portal nu este activ. Contactează administratorul asociației.',
          });
        }
        const apartmentsCount = Number(residentProfile._count?.apartmentResidents || 0) || (residentProfile.apartmentId ? 1 : 0);
        if (apartmentsCount < 1) {
          throw new ForbiddenException({
            code: 'RESIDENT_APARTMENT_LINK_MISSING',
            message: 'Contul tău nu este legat de niciun apartament.',
          });
        }
      }

      request.user = {
        ...user,
        sub: user.id,
      } satisfies MvpUser;

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof ForbiddenException) throw error;
      throw new UnauthorizedException({
        code: 'SESSION_EXPIRED',
        message: 'Sesiunea a expirat. Te rugăm să te autentifici din nou.',
      });
    }
  }
}

@Injectable()
export class MvpRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles?.length) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as MvpUser | undefined;
    if (!user?.role) {
      throw new UnauthorizedException({
        code: 'AUTH_REQUIRED',
        message: 'Trebuie să te autentifici.',
      });
    }

    const currentRole = normalizeRole(user.role);
    const allowed = requiredRoles.some((role) => normalizeRole(role) === currentRole);
    if (!allowed) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_ROLE',
        message: 'Nu ai acces la această zonă.',
      });
    }

    return true;
  }
}
