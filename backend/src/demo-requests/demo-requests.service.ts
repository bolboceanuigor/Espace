import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CancelDemoRequestDto,
  CreateDemoRequestDto,
  ScheduleDemoRequestDto,
  UpdateDemoRequestDto,
} from './dto/demo-requests.dto';

type AuthUser = { id?: string; sub?: string; role?: string };

@Injectable()
export class DemoRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly emailService: EmailService,
  ) {}

  private assertSuperadmin(user: AuthUser) {
    const role = String(user.role || '').toUpperCase();
    if (!['SUPERADMIN', 'SUPER_ADMIN'].includes(role)) {
      throw new ForbiddenException('Super admin access required');
    }
  }

  private async upsertLead(dto: CreateDemoRequestDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const normalizedPhone = dto.phone.trim();
    const existing = await this.prisma.lead.findFirst({
      where: {
        OR: [{ email: normalizedEmail }, { phone: normalizedPhone }],
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });
    if (existing) {
      const lead = await this.prisma.lead.update({
        where: { id: existing.id },
        data: {
          name: dto.name.trim(),
          phone: normalizedPhone,
          email: normalizedEmail,
          associationName: dto.associationName?.trim() || null,
          apartmentsCount: dto.apartmentsCount ?? null,
          notes: dto.message?.trim() || null,
          source: 'WEBSITE',
        },
        select: { id: true },
      });
      return lead.id;
    }
    const lead = await this.prisma.lead.create({
      data: {
        name: dto.name.trim(),
        phone: normalizedPhone,
        email: normalizedEmail,
        associationName: dto.associationName?.trim() || null,
        apartmentsCount: dto.apartmentsCount ?? null,
        notes: dto.message?.trim() || null,
        source: 'WEBSITE',
        status: 'NEW',
      },
      select: { id: true },
    });
    return lead.id;
  }

  private async notifySuperadminsInApp(demoRequestId: string, leadId: string | null, name: string) {
    const superadmins = await this.prisma.user.findMany({
      where: {
        role: { in: ['SUPERADMIN', 'SUPER_ADMIN'] as any },
        isActive: true,
        deletedAt: null,
        organizationId: { not: null },
      },
      select: { id: true, organizationId: true },
      take: 200,
    });
    for (const superadmin of superadmins) {
      if (!superadmin.organizationId) continue;
      await this.notificationsService.createNotification({
        organizationId: superadmin.organizationId,
        userId: superadmin.id,
        type: NotificationType.SYSTEM,
        title: 'Cerere demo noua',
        message: `Lead nou pentru demo: ${name}`,
        link: `/superadmin/demo-requests/${demoRequestId}${leadId ? `?leadId=${leadId}` : ''}`,
        preferredChannels: ['IN_APP'],
      });
    }
  }

  private async sendLeadConfirmationEmail(dto: CreateDemoRequestDto) {
    if (!this.emailService.isDeliveryConfigured()) return;
    const association = dto.associationName?.trim() ? ` pentru ${dto.associationName.trim()}` : '';
    await this.emailService.sendGenericEmail({
      to: dto.email.trim().toLowerCase(),
      subject: 'Confirmare cerere demo - Espace Condo',
      text: `Salut ${dto.name.trim()},\nAm primit cererea ta de demo${association}. Revenim in cel mai scurt timp pentru programare.\nMultumim!`,
      html: `<p>Salut ${dto.name.trim()},</p><p>Am primit cererea ta de demo${association}. Revenim in cel mai scurt timp pentru programare.</p><p>Multumim!</p>`,
    });
  }

  async createPublic(dto: CreateDemoRequestDto) {
    const leadId = await this.upsertLead(dto);
    const created = await (this.prisma as any).demoRequest.create({
      data: {
        leadId,
        name: dto.name.trim(),
        phone: dto.phone.trim(),
        email: dto.email.trim().toLowerCase(),
        associationName: dto.associationName?.trim() || null,
        apartmentsCount: dto.apartmentsCount ?? null,
        preferredDate: dto.preferredDate?.trim() || null,
        preferredTime: dto.preferredTime?.trim() || null,
        message: dto.message?.trim() || null,
      },
      include: { lead: { select: { id: true, status: true } } },
    });
    await this.notifySuperadminsInApp(created.id, leadId, created.name);
    await this.sendLeadConfirmationEmail(dto);
    return created;
  }

  async listForSuperadmin(user: AuthUser, status?: string) {
    this.assertSuperadmin(user);
    return (this.prisma as any).demoRequest.findMany({
      where: status ? { status: status as any } : undefined,
      include: {
        lead: { select: { id: true, status: true, source: true, organizationId: true } },
      },
      orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }],
      take: 500,
    });
  }

  async getForSuperadmin(user: AuthUser, id: string) {
    this.assertSuperadmin(user);
    const row = await (this.prisma as any).demoRequest.findUnique({
      where: { id },
      include: { lead: true },
    });
    if (!row) throw new NotFoundException('Demo request not found');
    return row;
  }

  async updateForSuperadmin(user: AuthUser, id: string, dto: UpdateDemoRequestDto) {
    this.assertSuperadmin(user);
    await this.getForSuperadmin(user, id);
    return (this.prisma as any).demoRequest.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone.trim() } : {}),
        ...(dto.email !== undefined ? { email: dto.email.trim().toLowerCase() } : {}),
        ...(dto.associationName !== undefined ? { associationName: dto.associationName?.trim() || null } : {}),
        ...(dto.apartmentsCount !== undefined ? { apartmentsCount: dto.apartmentsCount } : {}),
        ...(dto.preferredDate !== undefined ? { preferredDate: dto.preferredDate?.trim() || null } : {}),
        ...(dto.preferredTime !== undefined ? { preferredTime: dto.preferredTime?.trim() || null } : {}),
        ...(dto.message !== undefined ? { message: dto.message?.trim() || null } : {}),
        ...(dto.status !== undefined ? { status: dto.status as any } : {}),
        ...(dto.scheduledAt !== undefined ? { scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null } : {}),
        ...(dto.leadId !== undefined ? { leadId: dto.leadId || null } : {}),
      },
      include: { lead: true },
    });
  }

  async schedule(user: AuthUser, id: string, dto: ScheduleDemoRequestDto) {
    this.assertSuperadmin(user);
    const updated = await (this.prisma as any).demoRequest.update({
      where: { id },
      data: { status: 'SCHEDULED', scheduledAt: new Date(dto.scheduledAt) },
      include: { lead: true },
    });
    if (updated.leadId) {
      await this.prisma.lead.update({
        where: { id: updated.leadId },
        data: { status: 'DEMO_SCHEDULED' },
      });
    }
    return updated;
  }

  async complete(user: AuthUser, id: string) {
    this.assertSuperadmin(user);
    const updated = await (this.prisma as any).demoRequest.update({
      where: { id },
      data: { status: 'COMPLETED' },
      include: { lead: true },
    });
    if (updated.leadId) {
      await this.prisma.leadActivity.create({
        data: {
          leadId: updated.leadId,
          type: 'DEMO',
          content: 'Demo finalizat',
          createdByUserId: user.id || user.sub || '',
        },
      });
    }
    return updated;
  }

  async cancel(user: AuthUser, id: string, dto: CancelDemoRequestDto) {
    this.assertSuperadmin(user);
    return (this.prisma as any).demoRequest.update({
      where: { id },
      data: { status: (dto.status || 'CANCELLED') as any },
      include: { lead: true },
    });
  }
}
