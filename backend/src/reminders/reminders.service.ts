import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateApartmentReminderSettingsDto, UpsertReminderRuleDto } from './dto/reminders.dto';

type AuthUser = { id?: string; sub?: string; role?: string; organizationId?: string | null };

@Injectable()
export class RemindersService {
  constructor(private readonly prisma: PrismaService) {}

  private assertAdmin(user: AuthUser) {
    if (String(user.role || '').toUpperCase() !== 'ADMIN') throw new ForbiddenException('Admin access required');
    if (!user.organizationId) throw new ForbiddenException('Organization context missing');
    return { organizationId: user.organizationId };
  }

  private assertSuperadmin(user: AuthUser) {
    const role = String(user.role || '').toUpperCase();
    if (!['SUPERADMIN', 'SUPER_ADMIN'].includes(role)) throw new ForbiddenException('Super admin access required');
  }

  async adminListRules(user: AuthUser) {
    const { organizationId } = this.assertAdmin(user);
    return this.prisma.reminderRule.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async adminCreateRule(user: AuthUser, dto: UpsertReminderRuleDto) {
    const { organizationId } = this.assertAdmin(user);
    return this.prisma.reminderRule.create({
      data: {
        organizationId,
        name: dto.name,
        isActive: dto.isActive ?? true,
        triggerType: dto.triggerType,
        daysOffset: dto.daysOffset ?? null,
        debtThreshold: dto.debtThreshold ?? null,
        channelsJson: dto.channelsJson || ['IN_APP'],
        messageTemplate: dto.messageTemplate,
      },
    });
  }

  async adminUpdateRule(user: AuthUser, id: string, dto: Partial<UpsertReminderRuleDto>) {
    const { organizationId } = this.assertAdmin(user);
    const existing = await this.prisma.reminderRule.findFirst({ where: { id, organizationId }, select: { id: true } });
    if (!existing) throw new NotFoundException('Reminder rule not found');
    return this.prisma.reminderRule.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.triggerType !== undefined ? { triggerType: dto.triggerType } : {}),
        ...(dto.daysOffset !== undefined ? { daysOffset: dto.daysOffset } : {}),
        ...(dto.debtThreshold !== undefined ? { debtThreshold: dto.debtThreshold } : {}),
        ...(dto.channelsJson !== undefined ? { channelsJson: dto.channelsJson } : {}),
        ...(dto.messageTemplate !== undefined ? { messageTemplate: dto.messageTemplate } : {}),
      },
    });
  }

  async adminDeleteRule(user: AuthUser, id: string) {
    const { organizationId } = this.assertAdmin(user);
    const existing = await this.prisma.reminderRule.findFirst({ where: { id, organizationId }, select: { id: true } });
    if (!existing) throw new NotFoundException('Reminder rule not found');
    await this.prisma.reminderRule.delete({ where: { id } });
    return { ok: true };
  }

  async adminListLogs(user: AuthUser) {
    const { organizationId } = this.assertAdmin(user);
    return this.prisma.reminderLog.findMany({
      where: { organizationId },
      include: {
        apartment: { select: { id: true, number: true, building: { select: { name: true } }, staircase: { select: { name: true } } } },
        invoice: { select: { id: true, invoiceNumber: true } },
        reminderRule: { select: { id: true, name: true, triggerType: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  async adminUpdateApartmentSettings(user: AuthUser, apartmentId: string, dto: UpdateApartmentReminderSettingsDto) {
    const { organizationId } = this.assertAdmin(user);
    const apartment = await this.prisma.apartment.findFirst({ where: { id: apartmentId, organizationId }, select: { id: true } });
    if (!apartment) throw new NotFoundException('Apartment not found');
    return this.prisma.apartmentReminderSettings.upsert({
      where: { organizationId_apartmentId: { organizationId, apartmentId } },
      create: {
        organizationId,
        apartmentId,
        remindersPaused: dto.remindersPaused,
        pauseReason: dto.pauseReason || null,
        pausedUntil: dto.pausedUntil ? new Date(dto.pausedUntil) : null,
      },
      update: {
        remindersPaused: dto.remindersPaused,
        pauseReason: dto.pauseReason || null,
        pausedUntil: dto.pausedUntil ? new Date(dto.pausedUntil) : null,
      },
    });
  }

  async superadminOverview(user: AuthUser) {
    this.assertSuperadmin(user);
    const [rules, logs, sentToday] = await Promise.all([
      this.prisma.reminderRule.count(),
      this.prisma.reminderLog.count(),
      this.prisma.reminderLog.count({
        where: {
          status: 'SENT',
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
    ]);
    return { totalRules: rules, totalLogs: logs, sentToday };
  }
}

