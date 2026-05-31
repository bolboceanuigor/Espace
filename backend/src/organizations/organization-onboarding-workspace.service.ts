import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  InvitationStatus,
  OnboardingStatus,
  OrganizationLaunchStatus,
  OrganizationStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { MvpUser } from '../security/mvp-auth.guard';

type ChecklistStatus = 'complete' | 'incomplete' | 'warning' | 'optional';
type IssueSeverity = 'BLOCKING' | 'WARNING';
type ChecklistSectionKey =
  | 'BASIC_INFO'
  | 'ADMIN'
  | 'STRUCTURE'
  | 'APARTMENTS'
  | 'RESIDENTS'
  | 'METERS'
  | 'BILLING'
  | 'DOCUMENTS'
  | 'FINAL_REVIEW';

const ONBOARDING_STEPS: ChecklistSectionKey[] = [
  'BASIC_INFO',
  'STRUCTURE',
  'APARTMENTS',
  'RESIDENTS',
  'METERS',
  'BILLING',
  'DOCUMENTS',
  'FINAL_REVIEW',
];

const STEP_LABELS: Record<ChecklistSectionKey, string> = {
  BASIC_INFO: 'Date generale',
  ADMIN: 'Administrator',
  STRUCTURE: 'Structura blocuri/scari',
  APARTMENTS: 'Apartamente',
  RESIDENTS: 'Locatari',
  METERS: 'Contoare',
  BILLING: 'Facturare',
  DOCUMENTS: 'Documente',
  FINAL_REVIEW: 'Revizuire finala',
};

@Injectable()
export class OrganizationOnboardingWorkspaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getWorkspace(id: string) {
    return this.buildWorkspace(id);
  }

  async updateWorkspace(user: MvpUser, id: string, body: unknown) {
    const payload = this.parseUpdateBody(body);
    const before = await this.prisma.organization.findUnique({
      where: { id },
      select: { id: true, name: true, onboardingStatus: true, onboardingStep: true, launchStatus: true, onboardingNote: true, launchedAt: true },
    });
    if (!before) throw new NotFoundException('Organizatia nu a fost gasita.');
    const wantsReady = payload.onboardingStatus === OnboardingStatus.READY_FOR_LAUNCH || payload.launchStatus === OrganizationLaunchStatus.READY;
    const wantsLive = payload.onboardingStatus === OnboardingStatus.LAUNCHED || payload.launchStatus === OrganizationLaunchStatus.LIVE;

    if (wantsReady || wantsLive) {
      const current = await this.buildWorkspace(id);
      if (current.blockingErrors.length) {
        throw new BadRequestException({
          code: 'ONBOARDING_BLOCKED',
          message: 'Organizatia are probleme critice si nu poate fi marcata pentru lansare.',
          blockingErrors: current.blockingErrors,
        });
      }
    }

    const now = new Date();
    const data: Prisma.OrganizationUpdateInput = {};
    if (payload.onboardingStatus) data.onboardingStatus = payload.onboardingStatus;
    if (payload.onboardingStep) data.onboardingStep = payload.onboardingStep;
    if (payload.onboardingNote !== undefined) data.onboardingNote = payload.onboardingNote;
    if (payload.launchStatus) data.launchStatus = payload.launchStatus;

    if (payload.onboardingStatus === OnboardingStatus.IN_PROGRESS) {
      data.onboardingStartedAt = now;
      if (!payload.launchStatus) data.launchStatus = OrganizationLaunchStatus.INTERNAL_REVIEW;
    }
    if (payload.onboardingStatus === OnboardingStatus.READY_FOR_LAUNCH && !payload.launchStatus) {
      data.launchStatus = OrganizationLaunchStatus.READY;
    }
    if (payload.onboardingStatus === OnboardingStatus.BLOCKED && !payload.launchStatus) {
      data.launchStatus = OrganizationLaunchStatus.INTERNAL_REVIEW;
    }
    if (wantsLive) {
      data.onboardingStatus = OnboardingStatus.LAUNCHED;
      data.launchStatus = OrganizationLaunchStatus.LIVE;
      data.launchedAt = now;
      data.onboardingCompleted = true;
      data.onboardingCompletedAt = now;
      data.status = OrganizationStatus.ACTIVE;
      data.isActive = true;
    }

    const updated = await this.prisma.organization.update({
      where: { id },
      data,
      select: { id: true, name: true, onboardingStatus: true, onboardingStep: true, launchStatus: true, onboardingNote: true, launchedAt: true },
    }).catch(() => {
      throw new NotFoundException('Organizatia nu a fost gasita.');
    });

    await this.writeAudit(user, id, wantsLive ? 'ORGANIZATION_LAUNCHED' : 'ONBOARDING_STATUS_CHANGED', before, updated);
    return this.recalculateWorkspace(user, id);
  }

  async recalculateWorkspace(user: MvpUser, id: string) {
    const workspace = await this.buildWorkspace(id);
    await this.prisma.organization.update({
      where: { id },
      data: {
        launchChecklistJson: this.toChecklistJson(workspace),
        onboardingStartedAt: workspace.organization.onboardingStartedAt || new Date(),
      },
      select: { id: true },
    });
    await this.writeAudit(user, id, 'ORGANIZATION_ONBOARDING_RECALCULATED').catch(() => undefined);
    return this.buildWorkspace(id);
  }

  private async buildWorkspace(id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        legalName: true,
        fiscalCode: true,
        address: true,
        city: true,
        country: true,
        status: true,
        onboardingStatus: true,
        onboardingStep: true,
        launchStatus: true,
        onboardingStartedAt: true,
        onboardingCompletedAt: true,
        launchedAt: true,
        onboardingNote: true,
        launchChecklistJson: true,
        adminHandoverStatus: true,
        adminInvitedAt: true,
        adminAcceptedAt: true,
        adminFirstLoginAt: true,
        adminHandoverNote: true,
        createdAt: true,
      },
    });
    if (!organization) throw new NotFoundException('Organizatia nu a fost gasita.');

    const [
      blocksCount,
      entrancesCount,
      apartmentsCount,
      apartmentsWithResidentsCount,
      residentsCount,
      activeUsersCount,
      metersCount,
      invoicesCount,
      residentInvoicesCount,
      documents,
      announcementsCount,
      settings,
      admins,
      pendingAdminInvite,
      accessRequest,
      paymentProviderConfigsCount,
    ] = await Promise.all([
      this.prisma.building.count({ where: { organizationId: id } }),
      this.prisma.staircase.count({ where: { organizationId: id } }),
      this.prisma.apartment.count({ where: { organizationId: id, archivedAt: null } }),
      this.prisma.apartment.count({ where: { organizationId: id, archivedAt: null, apartmentResidents: { some: {} } } }),
      this.prisma.residentProfile.count({ where: { organizationId: id, archivedAt: null } }),
      this.prisma.user.count({ where: { organizationId: id, isActive: true, deletedAt: null } }),
      this.prisma.meter.count({ where: { organizationId: id, archivedAt: null } }),
      this.prisma.invoice.count({ where: { organizationId: id } }),
      this.prisma.residentInvoice.count({ where: { organizationId: id } }),
      this.prisma.document.findMany({
        where: { organizationId: id },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: { id: true, title: true, description: true, fileName: true, createdAt: true },
      }),
      this.prisma.announcement.count({ where: { organizationId: id, archivedAt: null } }),
      this.prisma.organizationSetting.findUnique({
        where: { organizationId: id },
        select: {
          maintenanceFeePerM2: true,
          repairFundPerM2: true,
          developmentFundFixed: true,
          contactEmail: true,
          contactPhone: true,
        },
      }),
      this.prisma.user.findMany({
        where: { organizationId: id, role: Role.ADMIN, deletedAt: null },
        orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          email: true,
          fullName: true,
          firstName: true,
          lastName: true,
          phone: true,
          isActive: true,
          passwordHash: true,
          googleSub: true,
          emailVerifiedAt: true,
          createdAt: true,
          organizationMember: { select: { role: true, status: true } },
        },
      }),
      this.prisma.invitation.findFirst({
        where: { organizationId: id, role: Role.ADMIN, status: InvitationStatus.PENDING },
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, email: true, phone: true, status: true, expiresAt: true, acceptedAt: true, createdAt: true },
      }),
      this.prisma.customerOnboardingRequest.findFirst({
        where: { OR: [{ convertedOrganizationId: id }, { convertedAssociationId: id }] },
        orderBy: [{ convertedAt: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          fullName: true,
          phone: true,
          email: true,
          associationName: true,
          city: true,
          createdAt: true,
          convertedAt: true,
        },
      }),
      this.prisma.paymentProviderConfig.count({ where: { organizationId: id } }).catch(() => 0),
    ]);

    const stats = {
      blocksCount,
      entrancesCount,
      apartmentsCount,
      residentsCount,
      activeUsersCount,
      metersCount,
      invoicesCount: invoicesCount + residentInvoicesCount,
      documentsCount: documents.length,
      announcementsCount,
    };

    const issues: Array<{ code: string; section: ChecklistSectionKey; message: string; severity: IssueSeverity; blocking: boolean }> = [];
    const addIssue = (section: ChecklistSectionKey, code: string, message: string, blocking = false) => {
      issues.push({ code, section, message, severity: blocking ? 'BLOCKING' : 'WARNING', blocking });
    };

    const checklistJson = this.jsonObject(organization.launchChecklistJson);
    const missingApcCodeAccepted = checklistJson.missingApcCodeAccepted === true;
    const activeAdmins = admins.filter((admin) => admin.isActive);
    const firstAdmin = activeAdmins[0] || admins[0] || null;
    const activeOrgAdmin = activeAdmins.find((admin) => admin.organizationMember?.status === 'ACTIVE') || activeAdmins[0] || null;
    const adminCanLogin = !!activeOrgAdmin && !!(activeOrgAdmin.passwordHash || activeOrgAdmin.googleSub);
    const billingSettingsConfigured = !!settings;
    const tariffsConfigured =
      !!settings &&
      (Number(settings.maintenanceFeePerM2 || 0) > 0 ||
        Number(settings.repairFundPerM2 || 0) > 0 ||
        Number(settings.developmentFundFixed || 0) > 0);
    const documentCoverage = this.documentCoverage(documents);

    if (!organization.name?.trim()) addIssue('BASIC_INFO', 'ORG_NAME_MISSING', 'Lipsește numele organizației.', true);
    if (!organization.city?.trim()) addIssue('BASIC_INFO', 'CITY_MISSING', 'Lipsește orașul organizației.', true);
    if (!organization.address?.trim()) addIssue('BASIC_INFO', 'ADDRESS_MISSING', 'Lipsește adresa organizației.', true);
    if (!organization.fiscalCode?.trim() && !missingApcCodeAccepted) addIssue('BASIC_INFO', 'APC_CODE_MISSING', 'Lipsește codul APC.', false);
    if (!activeAdmins.length) addIssue('ADMIN', 'ADMIN_MISSING', 'Nu există admin activ.', true);
    if (activeAdmins.length && !firstAdmin?.phone) addIssue('ADMIN', 'ADMIN_PHONE_MISSING', 'Adminul nu are telefon completat.', false);
    if (activeAdmins.length && !firstAdmin?.email && !firstAdmin?.phone) addIssue('ADMIN', 'ADMIN_CONTACT_MISSING', 'Adminul nu are email sau contact alternativ.', true);
    if (activeAdmins.length && !adminCanLogin) addIssue('ADMIN', 'ADMIN_ACCESS_NOT_ACTIVE', 'Adminul nu are acces activ în cont.', true);
    if (!blocksCount) addIssue('STRUCTURE', 'BUILDINGS_MISSING', 'Nu există blocuri adăugate.', true);
    if (!entrancesCount) addIssue('STRUCTURE', 'ENTRANCES_MISSING', 'Nu există scări/intrări adăugate.', true);
    if (!apartmentsCount) addIssue('APARTMENTS', 'APARTMENTS_MISSING', 'Nu există apartamente adăugate.', true);
    if (!residentsCount) addIssue('RESIDENTS', 'RESIDENTS_MISSING', 'Nu există locatari importați.', true);
    if (apartmentsCount > 0 && apartmentsWithResidentsCount === 0) {
      addIssue('RESIDENTS', 'APARTMENTS_WITHOUT_RESIDENTS', 'Niciun apartament nu are locatar/proprietar atribuit.', true);
    }
    if (!metersCount) addIssue('METERS', 'METERS_MISSING', 'Contoarele nu sunt configurate încă.', false);
    if (!billingSettingsConfigured) addIssue('BILLING', 'BILLING_SETTINGS_MISSING', 'Nu există setări de facturare.', false);
    if (billingSettingsConfigured && !tariffsConfigured) addIssue('BILLING', 'TARIFFS_NOT_CONFIGURED', 'Tarifele de bază nu sunt configurate.', false);
    if (!stats.invoicesCount) addIssue('BILLING', 'INVOICES_NOT_STARTED', 'Nu există facturi încă. Facturarea nu a fost pornită.', false);
    if (!documents.length) addIssue('DOCUMENTS', 'DOCUMENTS_MISSING', 'Nu există documente încărcate.', false);
    if (!documentCoverage.hasCoreDocument) addIssue('DOCUMENTS', 'CORE_DOCUMENTS_MISSING', 'Documentele de bază APC nu sunt complete.', false);

    const blockingErrors = issues.filter((issue) => issue.blocking);
    if (blockingErrors.length) addIssue('FINAL_REVIEW', 'FINAL_REVIEW_BLOCKED', 'Există probleme critice înainte de lansare.', true);
    if (!adminCanLogin) addIssue('FINAL_REVIEW', 'ADMIN_CANNOT_LOGIN', 'Adminul nu poate intra încă în cont.', true);

    const sections = [
      this.section('BASIC_INFO', [
        this.item('name', 'Organizația are nume', !!organization.name?.trim(), true),
        this.item('city', 'Oraș completat', !!organization.city?.trim(), true),
        this.item('address', 'Adresă completată', !!organization.address?.trim(), true),
        this.item('apcCode', 'Cod APC completat sau lipsă acceptată', !!organization.fiscalCode?.trim() || missingApcCodeAccepted, false),
      ], issues),
      this.section('ADMIN', [
        this.item('admin', 'Există cel puțin un Admin activ', !!activeAdmins.length, true),
        this.item('adminPhone', 'Adminul are telefon', !!firstAdmin?.phone, false),
        this.item('adminContact', 'Adminul are email sau contact alternativ', !!firstAdmin?.email || !!firstAdmin?.phone, true),
        this.item('adminAccess', 'Adminul poate intra în cont', adminCanLogin, true),
      ], issues),
      this.section('STRUCTURE', [
        this.item('building', 'Există cel puțin un bloc', blocksCount > 0, true),
        this.item('entrance', 'Există cel puțin o scară/intrare', entrancesCount > 0, true),
      ], issues),
      this.section('APARTMENTS', [
        this.item('apartments', 'Există apartamente', apartmentsCount > 0, true),
      ], issues),
      this.section('RESIDENTS', [
        this.item('residents', 'Există locatari/proprietari', residentsCount > 0, true),
        this.item('assignments', 'Apartamentele au locatari/proprietari atribuiți', apartmentsWithResidentsCount > 0, true),
      ], issues),
      this.section('METERS', [
        this.item('meters', 'Contoarele sunt configurate dacă se folosesc', metersCount > 0, false),
      ], issues, !metersCount),
      this.section('BILLING', [
        this.item('settings', 'Setările de facturare sunt inițializate', billingSettingsConfigured, false),
        this.item('tariffs', 'Tarifele de bază sunt configurate', tariffsConfigured, false),
        this.item('invoices', 'Facturarea a fost pornită', stats.invoicesCount > 0, false),
        this.item('payments', 'Provider de plăți configurat dacă se folosește', paymentProviderConfigsCount > 0, false),
      ], issues),
      this.section('DOCUMENTS', [
        this.item('documents', 'Există documente încărcate', documents.length > 0, false),
        this.item('statute', 'Statut APC', documentCoverage.statute, false),
        this.item('minutes', 'Proces-verbal', documentCoverage.minutes, false),
        this.item('managementContract', 'Contract administrare', documentCoverage.managementContract, false),
      ], issues),
      this.section('FINAL_REVIEW', [
        this.item('noBlockingErrors', 'Nu există erori critice', blockingErrors.length === 0, true),
        this.item('adminCanLogin', 'Adminul poate intra în cont', adminCanLogin, true),
      ], issues),
    ];

    const completedSteps = sections.filter((section) => section.status === 'complete' || section.status === 'optional').length;
    const progress = {
      percent: Math.round((completedSteps / sections.length) * 100),
      completedSteps,
      totalSteps: sections.length,
    };

    const warnings = issues.filter((issue) => !issue.blocking);
    const allBlockingErrors = issues.filter((issue) => issue.blocking);
    const missingData = issues.map((issue) => ({
      section: issue.section,
      code: issue.code,
      message: issue.message,
      blocking: issue.blocking,
    }));

    return {
      organization: {
        ...organization,
        associationCode: organization.fiscalCode || '',
      },
      progress,
      checklist: sections,
      warnings,
      blockingErrors: allBlockingErrors,
      missingData,
      canLaunch: allBlockingErrors.length === 0,
      sourceAccessRequest: accessRequest
        ? {
            id: accessRequest.id,
            contactName: accessRequest.fullName,
            phone: accessRequest.phone,
            email: accessRequest.email,
            associationName: accessRequest.associationName,
            city: accessRequest.city,
            requestedAt: accessRequest.createdAt,
            convertedAt: accessRequest.convertedAt,
          }
        : null,
      initialAdmin: firstAdmin
        ? {
            id: firstAdmin.id,
            fullName: this.fullName(firstAdmin),
            email: firstAdmin.email,
            phone: firstAdmin.phone,
            isActive: firstAdmin.isActive,
            canLogin: !!(firstAdmin.passwordHash || firstAdmin.googleSub),
            membershipStatus: firstAdmin.organizationMember?.status || null,
            createdAt: firstAdmin.createdAt,
        }
        : null,
      pendingAdminInvitation: pendingAdminInvite,
      adminHandover: {
        status: organization.adminHandoverStatus,
        invitedAt: organization.adminInvitedAt,
        acceptedAt: organization.adminAcceptedAt,
        firstLoginAt: organization.adminFirstLoginAt,
        note: organization.adminHandoverNote,
        pendingInvitation: pendingAdminInvite,
        initialAdmin: firstAdmin
          ? {
              id: firstAdmin.id,
              fullName: this.fullName(firstAdmin),
              email: firstAdmin.email,
              phone: firstAdmin.phone,
              isActive: firstAdmin.isActive,
              canLogin: !!(firstAdmin.passwordHash || firstAdmin.googleSub),
              membershipStatus: firstAdmin.organizationMember?.status || null,
            }
          : null,
      },
      stats,
      documentCoverage,
    };
  }

  private section(
    key: ChecklistSectionKey,
    items: Array<{ key: string; label: string; completed: boolean; required: boolean }>,
    issues: Array<{ section: ChecklistSectionKey; blocking: boolean }>,
    optional = false,
  ) {
    const sectionIssues = issues.filter((issue) => issue.section === key);
    const hasBlocking = sectionIssues.some((issue) => issue.blocking);
    const requiredIncomplete = items.some((item) => item.required && !item.completed);
    const allComplete = items.every((item) => item.completed || !item.required);
    let status: ChecklistStatus = 'complete';
    if (optional && !items.some((item) => item.completed)) status = 'optional';
    else if (hasBlocking || requiredIncomplete) status = 'incomplete';
    else if (sectionIssues.length || !allComplete) status = 'warning';
    return {
      key,
      title: STEP_LABELS[key],
      status,
      description: this.sectionDescription(key, status),
      items,
      action: this.sectionAction(key),
    };
  }

  private item(key: string, label: string, completed: boolean, required: boolean) {
    return { key, label, completed, required };
  }

  private sectionDescription(key: ChecklistSectionKey, status: ChecklistStatus) {
    const complete = status === 'complete';
    const descriptions: Record<ChecklistSectionKey, [string, string]> = {
      BASIC_INFO: ['Identitatea organizației este completă.', 'Completează numele, orașul, adresa și codul APC dacă există.'],
      ADMIN: ['Administratorul inițial este pregătit.', 'Creează sau activează primul administrator al organizației.'],
      STRUCTURE: ['Structura blocurilor și scărilor este inițializată.', 'Adaugă blocurile și scările/intrările administrate.'],
      APARTMENTS: ['Apartamentele sunt adăugate.', 'Adaugă sau importă apartamentele organizației.'],
      RESIDENTS: ['Locatarii/proprietarii sunt adăugați.', 'Importă locatarii și leagă-i de apartamente.'],
      METERS: ['Contoarele sunt configurate.', 'Configurează contoarele dacă organizația folosește citiri.'],
      BILLING: ['Facturarea este inițializată.', 'Configurează tarifele și pregătește primul ciclu de facturare.'],
      DOCUMENTS: ['Documentele de bază sunt disponibile.', 'Încarcă statutul, procesele-verbale, contractele și documentele APC.'],
      FINAL_REVIEW: ['Organizația poate fi lansată.', 'Rezolvă problemele critice înainte de activare.'],
    };
    return complete ? descriptions[key][0] : descriptions[key][1];
  }

  private sectionAction(key: ChecklistSectionKey) {
    const actions: Record<ChecklistSectionKey, { label: string; href: string }> = {
      BASIC_INFO: { label: 'Completează date', href: 'DETAIL' },
      ADMIN: { label: 'Invită administrator', href: 'DETAIL' },
      STRUCTURE: { label: 'Adaugă blocuri', href: 'WIZARD' },
      APARTMENTS: { label: 'Adaugă apartamente', href: 'WIZARD' },
      RESIDENTS: { label: 'Importă locatari', href: 'WIZARD' },
      METERS: { label: 'Configurează contoare', href: 'ADMIN_METERS' },
      BILLING: { label: 'Configurează facturare', href: 'ADMIN_BILLING' },
      DOCUMENTS: { label: 'Încarcă documente', href: 'ADMIN_DOCUMENTS' },
      FINAL_REVIEW: { label: 'Revizuire finală', href: 'DETAIL' },
    };
    return actions[key];
  }

  private parseUpdateBody(body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const onboardingStatus = this.optionalEnum(payload.onboardingStatus, OnboardingStatus, 'Statusul de onboarding nu este valid.');
    const launchStatus = this.optionalEnum(payload.launchStatus, OrganizationLaunchStatus, 'Statusul de lansare nu este valid.');
    const onboardingStep = this.optionalString(payload.onboardingStep);
    if (onboardingStep && !ONBOARDING_STEPS.includes(onboardingStep as ChecklistSectionKey)) {
      throw new BadRequestException('Pasul de onboarding nu este valid.');
    }
    const onboardingNote = payload.onboardingNote === null ? null : this.optionalString(payload.onboardingNote);
    return { onboardingStatus, launchStatus, onboardingStep, onboardingNote };
  }

  private optionalEnum<T extends Record<string, string>>(value: unknown, source: T, message: string) {
    if (value === undefined || value === null || value === '') return undefined;
    const text = String(value).trim();
    if (!Object.values(source).includes(text)) throw new BadRequestException(message);
    return text as T[keyof T];
  }

  private optionalString(value: unknown) {
    if (value === undefined || value === null) return undefined;
    return String(value).trim();
  }

  private documentCoverage(documents: Array<{ title: string; description: string | null; fileName: string }>) {
    const haystack = documents.map((doc) => `${doc.title} ${doc.description || ''} ${doc.fileName}`.toLowerCase());
    const includes = (patterns: string[]) => haystack.some((text) => patterns.some((pattern) => text.includes(pattern)));
    const statute = includes(['statut']);
    const minutes = includes(['proces-verbal', 'proces verbal', 'pv ']);
    const managementContract = includes(['contract administrare', 'contract']);
    const apcDocuments = includes(['apc', 'asociatie', 'asociație']);
    return {
      statute,
      minutes,
      managementContract,
      apcDocuments,
      hasCoreDocument: statute || minutes || managementContract || apcDocuments,
    };
  }

  private jsonObject(value: Prisma.JsonValue | null) {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }

  private toChecklistJson(workspace: any) {
    return {
      generatedAt: new Date().toISOString(),
      progress: workspace.progress,
      checklist: workspace.checklist,
      warnings: workspace.warnings,
      blockingErrors: workspace.blockingErrors,
      stats: workspace.stats,
    } as Prisma.InputJsonValue;
  }

  private fullName(user: { fullName: string | null; firstName: string | null; lastName: string | null; email: string }) {
    return user.fullName || [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email;
  }

  private async writeAudit(user: MvpUser, organizationId: string, action: string, before?: unknown, after?: unknown) {
    await this.audit.record({
      actorId: user.id,
      actorRole: user.role,
      organizationId,
      action,
      entityType: 'ORGANIZATION',
      entityId: organizationId,
      title: action === 'ORGANIZATION_LAUNCHED' ? 'Organizație lansată' : 'Onboarding actualizat',
      description: action === 'ORGANIZATION_LAUNCHED'
        ? 'Organizația a fost lansată din workspace-ul de onboarding.'
        : 'Workspace-ul de onboarding al organizației a fost actualizat.',
      severity: action === 'ORGANIZATION_LAUNCHED' ? 'SUCCESS' : 'INFO',
      before,
      after,
      actionUrl: `/ro/superadmin/organizations/${organizationId}/onboarding`,
    });
  }
}
