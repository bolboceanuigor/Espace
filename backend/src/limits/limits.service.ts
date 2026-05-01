import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateOrganizationLimitsDto } from './dto/update-organization-limits.dto';

type AuthUser = { id?: string; sub?: string; role?: string; organizationId?: string | null };

const DEFAULT_MODULES: Record<string, boolean> = {
  payments: true,
  invoices: true,
  reports: true,
  issues: true,
  voting: true,
  documents: true,
  imports: true,
  reconciliation: true,
  cameras: false,
  integrations: true,
};

@Injectable()
export class LimitsService {
  constructor(private readonly prisma: PrismaService) {}

  private isSuperAdmin(user: AuthUser) {
    const role = String(user.role || '').toUpperCase();
    return role === 'SUPERADMIN' || role === 'SUPER_ADMIN';
  }

  private assertAdmin(user: AuthUser) {
    if (String(user.role || '').toUpperCase() !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }
    if (!user.organizationId) throw new ForbiddenException('Organization context missing');
    return user.organizationId;
  }

  private async ensureOrgExists(organizationId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } });
    if (!org) throw new NotFoundException('Organization not found');
  }

  private normalizeModules(modulesJson?: Record<string, boolean> | null) {
    return { ...DEFAULT_MODULES, ...(modulesJson || {}) };
  }

  async getForOrganization(organizationId: string) {
    await this.ensureOrgExists(organizationId);
    const limits = await this.prisma.organizationLimits.findUnique({ where: { organizationId } });
    if (!limits) {
      return {
        organizationId,
        maxApartments: null,
        maxBuildings: null,
        maxTeamMembers: null,
        maxResidents: null,
        maxStorageMb: null,
        modulesJson: this.normalizeModules(null),
      };
    }
    return { ...limits, modulesJson: this.normalizeModules((limits.modulesJson as Record<string, boolean>) || null) };
  }

  async superadminGet(user: AuthUser, organizationId: string) {
    if (!this.isSuperAdmin(user)) throw new ForbiddenException('Super admin access required');
    return this.getForOrganization(organizationId);
  }

  async superadminUpdate(user: AuthUser, organizationId: string, dto: UpdateOrganizationLimitsDto) {
    if (!this.isSuperAdmin(user)) throw new ForbiddenException('Super admin access required');
    await this.ensureOrgExists(organizationId);
    const existing = await this.prisma.organizationLimits.findUnique({ where: { organizationId } });
    const currentModules = this.normalizeModules((existing?.modulesJson as Record<string, boolean>) || null);
    return this.prisma.organizationLimits.upsert({
      where: { organizationId },
      create: {
        organizationId,
        maxApartments: dto.maxApartments ?? null,
        maxBuildings: dto.maxBuildings ?? null,
        maxTeamMembers: dto.maxTeamMembers ?? null,
        maxResidents: dto.maxResidents ?? null,
        maxStorageMb: dto.maxStorageMb ?? null,
        modulesJson: this.normalizeModules(dto.modulesJson || null),
      },
      update: {
        ...(dto.maxApartments !== undefined ? { maxApartments: dto.maxApartments } : {}),
        ...(dto.maxBuildings !== undefined ? { maxBuildings: dto.maxBuildings } : {}),
        ...(dto.maxTeamMembers !== undefined ? { maxTeamMembers: dto.maxTeamMembers } : {}),
        ...(dto.maxResidents !== undefined ? { maxResidents: dto.maxResidents } : {}),
        ...(dto.maxStorageMb !== undefined ? { maxStorageMb: dto.maxStorageMb } : {}),
        ...(dto.modulesJson !== undefined ? { modulesJson: this.normalizeModules({ ...currentModules, ...dto.modulesJson }) } : {}),
      },
    });
  }

  async adminGet(user: AuthUser) {
    const organizationId = this.assertAdmin(user);
    return this.getForOrganization(organizationId);
  }

  async assertWithinCountLimit(
    user: AuthUser,
    organizationId: string,
    key: 'maxApartments' | 'maxBuildings' | 'maxTeamMembers' | 'maxResidents',
    currentCount: number,
  ) {
    if (this.isSuperAdmin(user)) return;
    const limits = await this.prisma.organizationLimits.findUnique({ where: { organizationId } });
    const max = limits?.[key];
    if (max && currentCount >= max) {
      throw new ForbiddenException('Organization usage limit reached');
    }
  }

  async assertStorageAllowance(user: AuthUser, organizationId: string, nextDocumentApproxMb = 1) {
    if (this.isSuperAdmin(user)) return;
    const limits = await this.prisma.organizationLimits.findUnique({ where: { organizationId } });
    if (!limits?.maxStorageMb) return;
    const usage = await this.prisma.fileAsset.aggregate({
      where: { organizationId },
      _sum: { sizeBytes: true },
    });
    const usedBytes = Number(usage._sum.sizeBytes || 0);
    const usedMb = usedBytes / (1024 * 1024);
    if (usedMb + nextDocumentApproxMb > limits.maxStorageMb) {
      throw new ForbiddenException('Organization storage limit reached');
    }
  }

  async assertModuleEnabled(user: AuthUser, organizationId: string, moduleKey: keyof typeof DEFAULT_MODULES) {
    if (this.isSuperAdmin(user)) return;
    const limits = await this.prisma.organizationLimits.findUnique({ where: { organizationId } });
    const modules = this.normalizeModules((limits?.modulesJson as Record<string, boolean>) || null);
    if (!modules[moduleKey]) {
      throw new ForbiddenException('Acest modul nu este activ în abonamentul dvs.');
    }
  }
}

