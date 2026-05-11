import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ResidentAccountStatus, ResidentPortalAccessStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { MvpUser } from './mvp-auth.guard';

@Injectable()
export class ResidentPortalGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: MvpUser; residentContext?: unknown }>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException({
        code: 'AUTH_REQUIRED',
        message: 'Trebuie să te autentifici.',
      });
    }
    if (String(user.role).toUpperCase() !== Role.RESIDENT) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_ROLE',
        message: 'Nu ai acces la portalul locatarilor.',
      });
    }

    const resident = await this.prisma.residentProfile.findFirst({
      where: { userId: user.id, organizationId: user.organizationId },
      select: {
        id: true,
        apartmentId: true,
        accountStatus: true,
        portalAccessStatus: true,
        _count: { select: { apartmentResidents: true } },
      },
    });
    if (!resident) {
      throw new ForbiddenException({
        code: 'RESIDENT_PORTAL_NOT_LINKED',
        message: 'Contul tău nu este încă legat de un locatar din asociație.',
      });
    }

    const status = resident.portalAccessStatus;
    if (status === ResidentPortalAccessStatus.SUSPENDED) {
      throw new ForbiddenException({
        code: 'RESIDENT_PORTAL_ACCESS_SUSPENDED',
        message: 'Accesul la portal este suspendat. Contactează administratorul asociației.',
      });
    }
    if (status === ResidentPortalAccessStatus.REVOKED) {
      throw new ForbiddenException({
        code: 'RESIDENT_PORTAL_ACCESS_REVOKED',
        message: 'Accesul la portal a fost revocat. Contactează administratorul asociației.',
      });
    }
    if (
      status === ResidentPortalAccessStatus.NO_ACCESS ||
      status === ResidentPortalAccessStatus.INVITED ||
      (!status && resident.accountStatus !== ResidentAccountStatus.CREATED)
    ) {
      throw new ForbiddenException({
        code: 'RESIDENT_PORTAL_ACCESS_NOT_ACTIVE',
        message: 'Accesul la portal nu este activ. Contactează administratorul asociației.',
      });
    }

    const apartmentsCount = Number(resident._count?.apartmentResidents || 0) || (resident.apartmentId ? 1 : 0);
    if (apartmentsCount < 1) {
      throw new ForbiddenException({
        code: 'RESIDENT_APARTMENT_LINK_MISSING',
        message: 'Contul tău nu este legat de niciun apartament.',
      });
    }

    request.residentContext = {
      residentId: resident.id,
      portalAccessStatus: ResidentPortalAccessStatus.ACTIVE,
      apartmentsCount,
    };
    return true;
  }
}
