import { Injectable } from '@nestjs/common';
import { ClientRiskLevel, ClientTaskStatus, Prisma, SaasInvoiceStatus, SaasSubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClientRiskService {
  constructor(private readonly prisma: PrismaService) {}

  async calculateRisk(clientAccountId: string) {
    const client = await this.prisma.clientAccount.findUnique({ where: { id: clientAccountId } });
    if (!client) return { level: ClientRiskLevel.NONE, score: 0, reasons: [] };
    const reasons = await this.getRiskReasons(client);
    const score = reasons.reduce((sum, reason) => sum + reason.score, 0);
    return { level: this.levelForScore(score), score, reasons };
  }

  async updateClientRisk(clientAccountId: string) {
    const risk = await this.calculateRisk(clientAccountId);
    await this.prisma.clientAccount.update({ where: { id: clientAccountId }, data: { riskLevel: risk.level } });
    return risk;
  }

  async getRiskReasons(client: { id: string; associationId: string | null; ownerUserId: string | null; lifecycleStage: string; updatedAt: Date; nextFollowUpAt: Date | null }) {
    const reasons: Array<{ key: string; label: string; score: number; severity: string }> = [];
    const now = new Date();
    if (!client.ownerUserId) reasons.push({ key: 'NO_OWNER', label: 'Client fara responsabil asignat.', score: 15, severity: 'MEDIUM' });
    if (client.nextFollowUpAt && client.nextFollowUpAt < now) reasons.push({ key: 'OVERDUE_FOLLOW_UP', label: 'Follow-up intarziat.', score: 20, severity: 'HIGH' });
    const daysSinceUpdate = Math.floor((Date.now() - client.updatedAt.getTime()) / 86400000);
    if (['PREPARING_ONBOARDING', 'ONBOARDING'].includes(client.lifecycleStage) && daysSinceUpdate > 14) {
      reasons.push({ key: 'ONBOARDING_STUCK', label: 'Onboarding blocat de peste 14 zile.', score: 20, severity: 'HIGH' });
    }
    if (daysSinceUpdate > 30) reasons.push({ key: 'NO_ACTIVITY_30_DAYS', label: 'Fara activitate recenta.', score: 15, severity: 'MEDIUM' });
    const overdueTasks = await this.prisma.clientTask.count({ where: { clientAccountId: client.id, status: { in: [ClientTaskStatus.OPEN, ClientTaskStatus.IN_PROGRESS] }, dueAt: { lt: now } } });
    if (overdueTasks) reasons.push({ key: 'OVERDUE_TASKS', label: `${overdueTasks} taskuri intarziate.`, score: 20, severity: 'HIGH' });
    if (client.associationId) {
      const [subscription, overdueInvoices, criticalDq] = await Promise.all([
        this.prisma.saasSubscription.findFirst({
          where: { associationId: client.associationId, status: { in: [SaasSubscriptionStatus.PAST_DUE, SaasSubscriptionStatus.SUSPENDED, SaasSubscriptionStatus.CANCELLED] } },
          select: { status: true },
          orderBy: { updatedAt: 'desc' },
        }),
        this.prisma.saasInvoice.count({ where: { associationId: client.associationId, status: { in: [SaasInvoiceStatus.ISSUED, SaasInvoiceStatus.OVERDUE, SaasInvoiceStatus.PARTIALLY_PAID] as any }, dueDate: { lt: now }, balanceAmount: { gt: 0 } } }),
        this.prisma.dataQualityIssue.count({ where: { associationId: client.associationId, severity: 'CRITICAL' as any, status: 'OPEN' as any } }).catch(() => 0),
      ]);
      if (subscription) reasons.push({ key: 'SUBSCRIPTION_ISSUE', label: `Abonament ${subscription.status}.`, score: 40, severity: 'CRITICAL' });
      if (overdueInvoices) reasons.push({ key: 'OVERDUE_SAAS_INVOICE', label: `${overdueInvoices} facturi SaaS restante.`, score: 30, severity: 'HIGH' });
      if (criticalDq) reasons.push({ key: 'CRITICAL_DATA_QUALITY', label: `${criticalDq} probleme critice Data Quality.`, score: 15, severity: 'MEDIUM' });
    }
    return reasons;
  }

  private levelForScore(score: number) {
    if (score >= 70) return ClientRiskLevel.CRITICAL;
    if (score >= 40) return ClientRiskLevel.HIGH;
    if (score >= 20) return ClientRiskLevel.MEDIUM;
    if (score > 0) return ClientRiskLevel.LOW;
    return ClientRiskLevel.NONE;
  }
}
