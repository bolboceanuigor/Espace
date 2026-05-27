import { ForbiddenException, Injectable } from '@nestjs/common';
import { Role, SaasSubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BLOCKING_SUBSCRIPTION_STATUSES, SaasFeatureKey, SaasLimitKey } from './saas-usage.types';
import { SaasUsageService } from './saas-usage.service';

type Actor = { id?: string; sub?: string; role?: string; organizationId?: string | null };

@Injectable()
export class SaasLimitEnforcementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usage: SaasUsageService,
  ) {}

  async assertCanCreateApartment(associationId: string, actor?: Actor) {
    await this.assertFeatureEnabled(associationId, 'apartmentsCrm', actor);
    await this.assertLimitAllows(associationId, 'maxApartments', 1, actor);
  }

  async assertCanCreateResident(associationId: string, actor?: Actor) {
    await this.assertFeatureEnabled(associationId, 'residentsCrm', actor);
    await this.assertLimitAllows(associationId, 'maxResidents', 1, actor);
  }

  async assertCanInviteStaff(associationId: string, actor?: Actor) {
    await this.assertFeatureEnabled(associationId, 'staffRoles', actor);
    await this.assertLimitAllows(associationId, 'maxStaffMembers', 1, actor);
  }

  async assertCanCreateMeter(associationId: string, actor?: Actor) {
    await this.assertFeatureEnabled(associationId, 'meterReadings', actor);
    await this.assertLimitAllows(associationId, 'maxMeters', 1, actor);
  }

  async assertCanGenerateInvoiceDraft(associationId: string, _billingMonth?: string, actor?: Actor) {
    await this.assertFeatureEnabled(associationId, 'internalInvoices', actor);
  }

  async assertCanFinalizeInvoices(associationId: string, billingMonth?: string, invoicesCount = 1, actor?: Actor) {
    await this.assertFeatureEnabled(associationId, 'internalInvoices', actor);
    await this.assertLimitAllows(associationId, 'maxInvoicesPerMonth', invoicesCount, actor, billingMonth);
  }

  async assertCanCreateAnnouncement(associationId: string, actor?: Actor) {
    await this.assertFeatureEnabled(associationId, 'announcements', actor);
    await this.assertLimitAllows(associationId, 'maxAnnouncementsPerMonth', 1, actor);
  }

  async assertCanCreateRequest(associationId: string, actor?: Actor) {
    await this.assertFeatureEnabled(associationId, 'requests', actor);
    await this.assertLimitAllows(associationId, 'maxRequestsPerMonth', 1, actor);
  }

  async assertCanImportCsv(associationId: string, _importType?: string, actor?: Actor) {
    await this.assertFeatureEnabled(associationId, 'csvImport', actor);
  }

  async assertCanExportCsv(associationId: string, _exportType?: string, actor?: Actor) {
    await this.assertFeatureEnabled(associationId, 'csvExport', actor);
  }

  async assertFeatureEnabled(associationId: string, featureKey: SaasFeatureKey, actor?: Actor) {
    if (this.isSuperadmin(actor)) return;
    const subscription = await this.usage.getCurrentSubscription(associationId);
    await this.assertSubscriptionAllowsWrite(associationId, actor, subscription?.status);
    if (!subscription) throw await this.blocked('SAAS_SUBSCRIPTION_REQUIRED', 'Asociația nu are încă un abonament configurat. Contactează Superadmin.', associationId, actor);
    const features = this.usage.extractFeatures(subscription);
    if (!features[featureKey]) {
      await this.auditBlock(associationId, actor, 'SAAS_FEATURE_BLOCKED', { featureKey, planName: subscription.plan.name });
      throw new ForbiddenException({
        statusCode: 403,
        code: 'SAAS_FEATURE_DISABLED',
        message: 'Această funcționalitate nu este disponibilă în planul curent.',
        details: { featureKey, planName: subscription.plan.name },
      });
    }
  }

  async assertSubscriptionAllowsWrite(associationId: string, actor?: Actor, status?: SaasSubscriptionStatus) {
    if (this.isSuperadmin(actor)) return;
    const subscription = status ? null : await this.usage.getCurrentSubscription(associationId);
    const currentStatus = status || subscription?.status;
    if (!currentStatus) throw await this.blocked('SAAS_SUBSCRIPTION_REQUIRED', 'Asociația nu are încă un abonament configurat. Contactează Superadmin.', associationId, actor);
    if (!BLOCKING_SUBSCRIPTION_STATUSES.includes(currentStatus)) return;
    const code =
      currentStatus === SaasSubscriptionStatus.SUSPENDED
        ? 'SAAS_SUBSCRIPTION_SUSPENDED'
        : currentStatus === SaasSubscriptionStatus.CANCELLED
          ? 'SAAS_SUBSCRIPTION_CANCELLED'
          : 'SAAS_SUBSCRIPTION_EXPIRED';
    await this.auditBlock(associationId, actor, 'SAAS_SUBSCRIPTION_WRITE_BLOCKED', { status: currentStatus });
    throw new ForbiddenException({
      statusCode: 403,
      code,
      message:
        currentStatus === SaasSubscriptionStatus.SUSPENDED
          ? 'Abonamentul asociației este suspendat. Contactează Superadmin.'
          : 'Abonamentul asociației nu permite acțiuni noi. Contactează Superadmin.',
    });
  }

  private async assertLimitAllows(associationId: string, limitKey: SaasLimitKey, increment: number, actor?: Actor, billingMonth?: string) {
    if (this.isSuperadmin(actor)) return;
    const data = await this.usage.getAssociationUsage(associationId, billingMonth);
    const limit = data.limits.find((item) => item.limitKey === limitKey);
    if (!limit || limit.limit === null || limit.used === null) return;
    if (limit.used + increment <= limit.limit) return;
    await this.auditBlock(associationId, actor, 'SAAS_LIMIT_EXCEEDED', limit);
    throw new ForbiddenException({
      statusCode: 403,
      code: 'SAAS_LIMIT_EXCEEDED',
      message: 'Limita planului a fost atinsă.',
      details: {
        limitKey,
        used: limit.used,
        limit: limit.limit,
        planName: data.subscription?.planName || null,
      },
    });
  }

  private async blocked(code: string, message: string, associationId: string, actor?: Actor) {
    await this.auditBlock(associationId, actor, 'SAAS_MUTATION_BLOCKED', { code });
    return new ForbiddenException({ statusCode: 403, code, message });
  }

  private isSuperadmin(actor?: Actor) {
    const role = String(actor?.role || '').toUpperCase();
    return role === Role.SUPERADMIN || role === 'SUPER_ADMIN';
  }

  private async auditBlock(associationId: string, actor: Actor | undefined, action: string, details: unknown) {
    const userId = actor?.id || actor?.sub;
    if (!userId) return;
    await this.prisma.auditLog.create({
      data: {
        organizationId: associationId,
        userId,
        action,
        entityType: 'SAAS_LIMIT',
        description: 'Acțiune blocată de limitele planului SaaS.',
        newValuesJson: details as any,
      },
    }).catch(() => undefined);
  }
}
