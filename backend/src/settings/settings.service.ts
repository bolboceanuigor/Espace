import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateOrganizationSettingsDto } from './dto/update-organization-settings.dto';
import { UpdateSettingsOrgDto } from './dto/update-settings-org.dto';
import { UpdateSettingsProfileDto } from './dto/update-settings-profile.dto';

const DEFAULT_MENU_CONFIG = [
  { key: 'dashboard', enabled: true, order: 0 },
  { key: 'chat', enabled: true, order: 1 },
  { key: 'apartments', enabled: true, order: 2 },
  { key: 'residents', enabled: true, order: 3 },
  { key: 'payments', enabled: true, order: 4 },
  { key: 'issues', enabled: true, order: 5 },
  { key: 'announcements', enabled: true, order: 6 },
  { key: 'settings', enabled: true, order: 7 },
] as const;

function toMenuConfigJson(
  menu: UpdateSettingsOrgDto['menuConfig'] | undefined,
): Prisma.InputJsonValue {
  const normalized = (menu ?? DEFAULT_MENU_CONFIG).map((item) => ({
    key: item.key,
    enabled: Boolean(item.enabled),
    order: Number(item.order),
  }));
  return normalized as Prisma.InputJsonValue;
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private orgSelect = {
    id: true,
    name: true,
    legalName: true,
    fiscalCode: true,
    address: true,
    phone: true,
    email: true,
    website: true,
    bankName: true,
    bankAccountIban: true,
    bankSwift: true,
    paymentInstructions: true,
    treasurerName: true,
    administratorName: true,
    logoUrl: true,
    primaryColor: true,
    invoicePrefix: true,
    receiptPrefix: true,
    defaultCurrency: true,
    defaultLocale: true,
    weekStart: true,
  } satisfies Prisma.OrganizationSelect;

  async getSettings(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        organizationId: true,
      },
    });
    if (!user?.organizationId) {
      throw new NotFoundException('User or organization not found');
    }

    const [organization, orgSetting] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: user.organizationId },
        select: this.orgSelect,
      }),
      this.prisma.organizationSetting.findUnique({
        where: { organizationId: user.organizationId },
        select: {
          defaultLocale: true,
          weekStart: true,
          appName: true,
          logoUrl: true,
          primaryColor: true,
          sidebarColor: true,
          themeMode: true,
          menuConfig: true,
        },
      }),
    ]);

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return {
      org: {
        id: organization.id,
        name: organization.name,
        defaultLocale: orgSetting?.defaultLocale ?? organization.defaultLocale ?? 'ro',
        weekStart: orgSetting?.weekStart ?? organization.weekStart ?? 'MONDAY',
        appName: orgSetting?.appName ?? organization.legalName ?? organization.name ?? 'Espace',
        logoUrl: orgSetting?.logoUrl ?? organization.logoUrl ?? null,
        primaryColor: orgSetting?.primaryColor ?? organization.primaryColor ?? '#2563eb',
        sidebarColor: orgSetting?.sidebarColor ?? '#ffffff',
        themeMode: (orgSetting?.themeMode as 'LIGHT' | 'DARK') ?? 'LIGHT',
        menuConfig: Array.isArray(orgSetting?.menuConfig) ? orgSetting?.menuConfig : DEFAULT_MENU_CONFIG,
      },
      profile: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      supportEmail: process.env.SUPPORT_EMAIL || 'support@espace.md',
    };
  }

  async updateOrg(userId: string, role: Role, dto: UpdateSettingsOrgDto) {
    if (role !== Role.ADMIN && role !== Role.SUPERADMIN) {
      throw new ForbiddenException('Only admin can update organization settings');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { organizationId: true },
    });
    if (!user?.organizationId) {
      throw new NotFoundException('Organization not found');
    }

    await this.prisma.organization.update({
      where: { id: user.organizationId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl || null } : {}),
        ...(dto.primaryColor !== undefined ? { primaryColor: dto.primaryColor || null } : {}),
        ...(dto.defaultLocale !== undefined ? { defaultLocale: dto.defaultLocale } : {}),
        ...(dto.weekStart !== undefined ? { weekStart: dto.weekStart } : {}),
      },
    });

    if (
      dto.defaultLocale !== undefined ||
      dto.weekStart !== undefined ||
      dto.appName !== undefined ||
      dto.logoUrl !== undefined ||
      dto.primaryColor !== undefined ||
      dto.sidebarColor !== undefined ||
      dto.themeMode !== undefined ||
      dto.menuConfig !== undefined
    ) {
      await this.prisma.organizationSetting.upsert({
        where: { organizationId: user.organizationId },
        create: {
          organizationId: user.organizationId,
          defaultLocale: dto.defaultLocale ?? 'ro',
          weekStart: dto.weekStart ?? 'MONDAY',
          appName: dto.appName ?? 'Espace',
          logoUrl: dto.logoUrl ?? null,
          primaryColor: dto.primaryColor ?? '#2563eb',
          sidebarColor: dto.sidebarColor ?? '#ffffff',
          themeMode: dto.themeMode ?? 'LIGHT',
          menuConfig: toMenuConfigJson(dto.menuConfig),
        },
        update: {
          ...(dto.defaultLocale !== undefined ? { defaultLocale: dto.defaultLocale } : {}),
          ...(dto.weekStart !== undefined ? { weekStart: dto.weekStart } : {}),
          ...(dto.appName !== undefined ? { appName: dto.appName } : {}),
          ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl } : {}),
          ...(dto.primaryColor !== undefined ? { primaryColor: dto.primaryColor } : {}),
          ...(dto.sidebarColor !== undefined ? { sidebarColor: dto.sidebarColor } : {}),
          ...(dto.themeMode !== undefined ? { themeMode: dto.themeMode } : {}),
          ...(dto.menuConfig !== undefined ? { menuConfig: toMenuConfigJson(dto.menuConfig) } : {}),
        },
      });
    }

    return this.getSettings(userId);
  }

  async getOrganizationSettingsForAdmin(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { role: true, organizationId: true },
    });
    if (!user?.organizationId) throw new NotFoundException('Organization not found');
    if (!['ADMIN', 'SUPERADMIN', 'SUPER_ADMIN'].includes(String(user.role || '').toUpperCase())) {
      throw new ForbiddenException('Admin access required');
    }
    const organization = await this.prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: this.orgSelect,
    });
    if (!organization) throw new NotFoundException('Organization not found');
    return organization;
  }

  async updateOrganizationSettingsForAdmin(userId: string, dto: UpdateOrganizationSettingsDto) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { role: true, organizationId: true },
    });
    if (!user?.organizationId) throw new NotFoundException('Organization not found');
    if (!['ADMIN', 'SUPERADMIN', 'SUPER_ADMIN'].includes(String(user.role || '').toUpperCase())) {
      throw new ForbiddenException('Admin access required');
    }
    const oldOrg = await this.prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: this.orgSelect,
    });
    const updated = await this.prisma.organization.update({
      where: { id: user.organizationId },
      data: { ...dto },
      select: this.orgSelect,
    });
    await this.auditService.logUpdate(
      { userId, organizationId: user.organizationId },
      'ORGANIZATION_SETTINGS',
      user.organizationId,
      oldOrg,
      updated,
      'Updated organization settings',
    );
    return updated;
  }

  async getOrganizationPublicInfo(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { organizationId: true },
    });
    if (!user?.organizationId) throw new NotFoundException('Organization not found');
    const organization = await this.prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: {
        name: true,
        address: true,
        phone: true,
        email: true,
        website: true,
        bankName: true,
        bankAccountIban: true,
        bankSwift: true,
        paymentInstructions: true,
        administratorName: true,
        logoUrl: true,
        primaryColor: true,
      },
    });
    if (!organization) throw new NotFoundException('Organization not found');
    return organization;
  }

  async getOrganizationSettingsForSuperadmin(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: this.orgSelect,
    });
    if (!organization) throw new NotFoundException('Organization not found');
    return organization;
  }

  async updateOrganizationSettingsForSuperadmin(actorUserId: string, organizationId: string, dto: UpdateOrganizationSettingsDto) {
    const existing = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Organization not found');
    const oldOrg = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: this.orgSelect,
    });
    const updated = await this.prisma.organization.update({
      where: { id: organizationId },
      data: { ...dto },
      select: this.orgSelect,
    });
    await this.auditService.logUpdate(
      { userId: actorUserId, organizationId },
      'ORGANIZATION_SETTINGS',
      organizationId,
      oldOrg,
      updated,
      'Updated organization settings by superadmin',
    );
    return updated;
  }

  async updateProfile(userId: string, dto: UpdateSettingsProfileDto) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.firstName !== undefined ? { firstName: dto.firstName || null } : {}),
        ...(dto.lastName !== undefined ? { lastName: dto.lastName || null } : {}),
      },
    });
    return this.getSettings(userId);
  }
}
