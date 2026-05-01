import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateOnboardingStepDto } from './dto/onboarding.dto';

type AuthUser = { id?: string; sub?: string; role?: string; organizationId?: string | null };

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  private assertAdmin(user: AuthUser) {
    if (String(user.role || '').toUpperCase() !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }
    if (!user.organizationId) throw new ForbiddenException('Organization context missing');
    return user.organizationId;
  }

  private assertSuperadmin(user: AuthUser) {
    const role = String(user.role || '').toUpperCase();
    if (!['SUPERADMIN', 'SUPER_ADMIN'].includes(role)) {
      throw new ForbiddenException('Super admin access required');
    }
  }

  private async getOrCreateChecklist(organizationId: string) {
    return this.prisma.onboardingChecklist.upsert({
      where: { organizationId },
      create: { organizationId },
      update: {},
    });
  }

  private progressFromChecklist(checklist: {
    buildingsCreated: boolean;
    apartmentsImported: boolean;
    residentsImported: boolean;
    tariffsConfigured: boolean;
    paymentProviderConfigured: boolean;
    firstInvoicesGenerated: boolean;
  }) {
    const completed = [
      checklist.buildingsCreated,
      checklist.apartmentsImported,
      checklist.residentsImported,
      checklist.tariffsConfigured,
      checklist.paymentProviderConfigured,
      checklist.firstInvoicesGenerated,
    ].filter(Boolean).length;
    return Math.round((completed / 6) * 100);
  }

  async adminGetOnboarding(user: AuthUser) {
    const organizationId = this.assertAdmin(user);
    const [organization, checklist] = await Promise.all([
      this.prisma.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: {
          id: true,
          name: true,
          onboardingStatus: true,
          onboardingStep: true,
          onboardingCompletedAt: true,
        },
      }),
      this.getOrCreateChecklist(organizationId),
    ]);
    return {
      organization,
      checklist,
      progress: this.progressFromChecklist(checklist),
    };
  }

  async adminUpdateStep(user: AuthUser, dto: UpdateOnboardingStepDto) {
    const organizationId = this.assertAdmin(user);
    await this.getOrCreateChecklist(organizationId);
    const [organization, checklist] = await this.prisma.$transaction([
      this.prisma.organization.update({
        where: { id: organizationId },
        data: {
          ...(dto.onboardingStatus ? { onboardingStatus: dto.onboardingStatus } : {}),
          ...(dto.onboardingStep !== undefined ? { onboardingStep: dto.onboardingStep } : {}),
          onboardingCompleted: dto.onboardingStatus === 'COMPLETED' ? true : undefined,
          onboardingCompletedAt: dto.onboardingStatus === 'COMPLETED' ? new Date() : undefined,
        },
        select: {
          id: true,
          name: true,
          onboardingStatus: true,
          onboardingStep: true,
          onboardingCompletedAt: true,
        },
      }),
      this.prisma.onboardingChecklist.update({
        where: { organizationId },
        data: {
          ...(dto.buildingsCreated !== undefined ? { buildingsCreated: dto.buildingsCreated } : {}),
          ...(dto.apartmentsImported !== undefined ? { apartmentsImported: dto.apartmentsImported } : {}),
          ...(dto.residentsImported !== undefined ? { residentsImported: dto.residentsImported } : {}),
          ...(dto.tariffsConfigured !== undefined ? { tariffsConfigured: dto.tariffsConfigured } : {}),
          ...(dto.paymentProviderConfigured !== undefined
            ? { paymentProviderConfigured: dto.paymentProviderConfigured }
            : {}),
          ...(dto.firstInvoicesGenerated !== undefined
            ? { firstInvoicesGenerated: dto.firstInvoicesGenerated }
            : {}),
        },
      }),
    ]);

    return { organization, checklist, progress: this.progressFromChecklist(checklist) };
  }

  async adminComplete(user: AuthUser) {
    const organizationId = this.assertAdmin(user);
    const organization = await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        onboardingCompleted: true,
        onboardingStatus: 'COMPLETED',
        onboardingStep: 'FINISHED',
        onboardingCompletedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        onboardingStatus: true,
        onboardingStep: true,
        onboardingCompletedAt: true,
      },
    });
    const checklist = await this.getOrCreateChecklist(organizationId);
    return { organization, checklist, progress: this.progressFromChecklist(checklist) };
  }

  async superadminOverview(user: AuthUser) {
    this.assertSuperadmin(user);
    const rows = await this.prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        onboardingStatus: true,
        onboardingStep: true,
        onboardingCompletedAt: true,
        onboardingChecklist: {
          select: {
            buildingsCreated: true,
            apartmentsImported: true,
            residentsImported: true,
            tariffsConfigured: true,
            paymentProviderConfigured: true,
            firstInvoicesGenerated: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      ...row,
      progress: this.progressFromChecklist(
        row.onboardingChecklist || {
          buildingsCreated: false,
          apartmentsImported: false,
          residentsImported: false,
          tariffsConfigured: false,
          paymentProviderConfigured: false,
          firstInvoicesGenerated: false,
        },
      ),
    }));
  }
}

