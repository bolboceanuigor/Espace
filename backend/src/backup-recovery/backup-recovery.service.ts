import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import {
  BackupCheckStatus,
  BackupScope,
  LaunchChecklistSeverity,
  PlatformServiceCriticality,
  PlatformServiceStatus,
  PlatformServiceType,
  Prisma,
  ProductionIncidentSeverity,
  ProductionIncidentStatus,
  RecoveryDrillStatus,
  RecoveryRunbookStatus,
} from '@prisma/client';
import { existsSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import {
  BACKUP_CHECKLIST_SEEDS,
  DANGEROUS_COMMANDS,
  EXPORT_CENTER_ITEMS,
  RECOVERY_RUNBOOK_SEEDS,
} from './backup-recovery.seed';
import {
  CompleteRecoveryDrillDto,
  CreateProductionIncidentDto,
  CreateRecoveryDrillDto,
  IncidentUpdateDto,
  UpdateBackupChecklistItemDto,
  UpdateProductionIncidentDto,
  UpdateRecoveryDrillDto,
  UpsertBackupCheckDto,
} from './dto/backup-recovery.dto';

type Actor = { id?: string; sub?: string; role?: string; organizationId?: string };

const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET', 'CORS_ORIGIN', 'NEXT_PUBLIC_API_URL'];
const CRITICAL_SERVICE_TYPES = [
  PlatformServiceType.DATABASE,
  PlatformServiceType.HOSTING_BACKEND,
  PlatformServiceType.HOSTING_FRONTEND,
  PlatformServiceType.SOURCE_CONTROL,
  PlatformServiceType.DOMAIN,
  PlatformServiceType.DNS,
];

@Injectable()
export class BackupRecoveryService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedInitialData();
  }

  private actorId(actor?: Actor | null) {
    return actor?.id || actor?.sub || null;
  }

  async seedInitialData() {
    for (const [key, category, title, description, severity, isRequired, actionUrl] of BACKUP_CHECKLIST_SEEDS) {
      await this.prisma.backupChecklistItem.upsert({
        where: { key },
        update: { category, title, description, severity: severity as LaunchChecklistSeverity, isRequired, actionUrl },
        create: { key, category, title, description, severity: severity as LaunchChecklistSeverity, isRequired, actionUrl },
      });
    }

    for (const runbook of RECOVERY_RUNBOOK_SEEDS) {
      await this.prisma.recoveryRunbook.upsert({
        where: { key: runbook.key },
        update: {
          title: runbook.title,
          description: runbook.description,
          scenario: runbook.scenario,
          severity: runbook.severity,
          steps: runbook.steps as unknown as Prisma.InputJsonValue,
          status: RecoveryRunbookStatus.ACTIVE,
        },
        create: {
          key: runbook.key,
          title: runbook.title,
          description: runbook.description,
          scenario: runbook.scenario,
          severity: runbook.severity,
          steps: runbook.steps as unknown as Prisma.InputJsonValue,
          status: RecoveryRunbookStatus.ACTIVE,
        },
      });
    }
  }

  async overview() {
    await this.seedInitialData();
    const [backupChecks, drills, incidents, checklist, runbooks, services, criticalErrors] = await Promise.all([
      this.prisma.backupCheck.findMany({ include: { checkedBy: { select: { id: true, email: true, fullName: true } } }, orderBy: { checkedAt: 'desc' }, take: 8 }),
      this.prisma.recoveryDrill.findMany({ include: { performedBy: { select: { id: true, email: true, fullName: true } } }, orderBy: { createdAt: 'desc' }, take: 8 }),
      this.prisma.productionIncident.findMany({ include: { assignedTo: { select: { id: true, email: true, fullName: true } } }, orderBy: { startedAt: 'desc' }, take: 8 }),
      this.prisma.backupChecklistItem.findMany(),
      this.prisma.recoveryRunbook.findMany({ where: { status: RecoveryRunbookStatus.ACTIVE } }),
      this.prisma.platformService.findMany(),
      this.prisma.systemErrorEvent.count({ where: { severity: 'CRITICAL', resolvedAt: null } }),
    ]);
    const readiness = await this.calculateReadiness({ checklist, services, backupChecks, runbooks, incidents, criticalErrors });
    const dbStatus = await this.safeDbStatus();
    return {
      readiness,
      database: this.databaseSummary(backupChecks, dbStatus),
      services: this.serviceSummary(services),
      recentBackupChecks: backupChecks,
      recentRecoveryDrills: drills,
      openIncidents: incidents.filter((item) => !([ProductionIncidentStatus.RESOLVED, ProductionIncidentStatus.CLOSED] as ProductionIncidentStatus[]).includes(item.status)),
      dangerousCommands: DANGEROUS_COMMANDS,
      criticalDataMap: this.criticalDataMap(),
      exportCenter: this.exportCenterItems(),
      checklistSummary: this.groupChecklistSummary(checklist),
    };
  }

  async checklist() {
    await this.seedInitialData();
    const items = await this.prisma.backupChecklistItem.findMany({
      include: { checkedBy: { select: { id: true, email: true, fullName: true } } },
      orderBy: [{ category: 'asc' }, { severity: 'desc' }, { title: 'asc' }],
    });
    return { items, grouped: this.groupChecklist(items) };
  }

  async runChecklist(actor?: Actor) {
    await this.seedInitialData();
    const [dbOk, backupChecks, runbooks, services] = await Promise.all([
      this.checkDb(),
      this.prisma.backupCheck.findMany(),
      this.prisma.recoveryRunbook.findMany({ where: { status: RecoveryRunbookStatus.ACTIVE } }),
      this.prisma.platformService.findMany(),
    ]);
    const repoRoot = join(process.cwd(), '..');
    const hasDbBackup = backupChecks.some((item) => item.scope === BackupScope.DATABASE && ([BackupCheckStatus.PASSED, BackupCheckStatus.WARNING] as BackupCheckStatus[]).includes(item.status));
    const restoreTested = backupChecks.some((item) => item.scope === BackupScope.DATABASE && item.restoreTested);
    const hasCriticalServices = services.some((item) => item.criticality === PlatformServiceCriticality.CRITICAL);
    const updates: Record<string, BackupCheckStatus> = {
      db_daily_backup_available: hasDbBackup ? BackupCheckStatus.PASSED : BackupCheckStatus.WARNING,
      db_restore_tested: restoreTested ? BackupCheckStatus.PASSED : BackupCheckStatus.WARNING,
      db_restore_documented: runbooks.length > 0 ? BackupCheckStatus.PASSED : BackupCheckStatus.WARNING,
      db_migrations_history: existsSync(join(repoRoot, 'backend/prisma/migrations')) ? BackupCheckStatus.PASSED : BackupCheckStatus.WARNING,
      db_no_destructive_reset: BackupCheckStatus.PASSED,
      source_package_lock: existsSync(join(repoRoot, 'package-lock.json')) || existsSync(join(repoRoot, 'frontend/package-lock.json')) || existsSync(join(repoRoot, 'backend/package-lock.json')) ? BackupCheckStatus.PASSED : BackupCheckStatus.WARNING,
      source_no_pnpm_lock: existsSync(join(repoRoot, 'pnpm-lock.yaml')) ? BackupCheckStatus.WARNING : BackupCheckStatus.PASSED,
      env_render_database_url: process.env.DATABASE_URL ? BackupCheckStatus.PASSED : BackupCheckStatus.FAILED,
      env_jwt_secret: process.env.JWT_SECRET ? BackupCheckStatus.PASSED : BackupCheckStatus.FAILED,
      env_cors_origin: process.env.CORS_ORIGIN ? BackupCheckStatus.PASSED : BackupCheckStatus.FAILED,
      env_next_public_api_url: process.env.NEXT_PUBLIC_API_URL ? BackupCheckStatus.PASSED : BackupCheckStatus.WARNING,
      launch_services_filled: hasCriticalServices ? BackupCheckStatus.PASSED : BackupCheckStatus.WARNING,
      deploy_last_build_passes: BackupCheckStatus.WARNING,
      db_strategy_documented: runbooks.some((item) => item.scenario === 'DATABASE_DOWN') ? BackupCheckStatus.PASSED : BackupCheckStatus.WARNING,
      deploy_rollback_strategy: runbooks.some((item) => item.scenario === 'FAILED_DEPLOY') ? BackupCheckStatus.PASSED : BackupCheckStatus.WARNING,
      db_url_env_only: BackupCheckStatus.PASSED,
      env_optional_providers_documented: BackupCheckStatus.PASSED,
    };
    if (!dbOk) updates.env_render_database_url = BackupCheckStatus.FAILED;

    await Promise.all(
      Object.entries(updates).map(([key, status]) =>
        this.prisma.backupChecklistItem.updateMany({
          where: { key },
          data: {
            status,
            checkedAt: new Date(),
            checkedById: this.actorId(actor),
            evidence: 'Auto-check rulat din Backup & Recovery.',
          },
        }),
      ),
    );
    return this.checklist();
  }

  async updateChecklistItem(id: string, dto: UpdateBackupChecklistItemDto, actor?: Actor) {
    const item = await this.prisma.backupChecklistItem.update({
      where: { id },
      data: {
        status: dto.status,
        severity: dto.severity,
        evidence: dto.evidence,
        checkedAt: new Date(),
        checkedById: this.actorId(actor),
      },
    });
    await this.audit('BACKUP_CHECK_UPDATED', 'BackupChecklistItem', item.id, `Backup checklist actualizat: ${item.title}`, actor, { key: item.key, status: item.status });
    return item;
  }

  async backupChecks() {
    return this.prisma.backupCheck.findMany({
      include: { checkedBy: { select: { id: true, email: true, fullName: true } } },
      orderBy: { checkedAt: 'desc' },
    });
  }

  async createBackupCheck(dto: UpsertBackupCheckDto, actor?: Actor) {
    const item = await this.prisma.backupCheck.create({ data: this.mapBackupCheckDto(dto, actor) });
    await this.audit('BACKUP_CHECK_CREATED', 'BackupCheck', item.id, `Backup check creat: ${item.title}`, actor, { scope: item.scope, status: item.status });
    return item;
  }

  async getBackupCheck(id: string) {
    const item = await this.prisma.backupCheck.findUnique({ where: { id }, include: { checkedBy: { select: { id: true, email: true, fullName: true } } } });
    if (!item) throw new NotFoundException('Verificarea de backup nu a fost gasita.');
    return item;
  }

  async updateBackupCheck(id: string, dto: UpsertBackupCheckDto, actor?: Actor) {
    await this.getBackupCheck(id);
    const item = await this.prisma.backupCheck.update({ where: { id }, data: this.mapBackupCheckDto(dto, actor) });
    await this.audit('BACKUP_CHECK_UPDATED', 'BackupCheck', item.id, `Backup check actualizat: ${item.title}`, actor, { scope: item.scope, status: item.status });
    return item;
  }

  async recoveryPlan() {
    await this.seedInitialData();
    const runbooks = await this.prisma.recoveryRunbook.findMany({ where: { status: RecoveryRunbookStatus.ACTIVE }, orderBy: [{ severity: 'desc' }, { title: 'asc' }] });
    return { runbooks, dangerousCommands: DANGEROUS_COMMANDS, serviceDependencies: await this.recoveryServices() };
  }

  async recoveryDrills() {
    return this.prisma.recoveryDrill.findMany({
      include: { performedBy: { select: { id: true, email: true, fullName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createRecoveryDrill(dto: CreateRecoveryDrillDto, actor?: Actor) {
    const drill = await this.prisma.recoveryDrill.create({
      data: {
        title: dto.title.trim(),
        description: dto.description.trim(),
        scope: dto.scope,
        scenario: dto.scenario || null,
        plannedAt: dto.plannedAt ? new Date(dto.plannedAt) : null,
        notes: dto.notes || null,
        performedById: this.actorId(actor),
      },
    });
    await this.audit('RECOVERY_DRILL_CREATED', 'RecoveryDrill', drill.id, `Recovery drill creat: ${drill.title}`, actor, { scope: drill.scope, status: drill.status });
    return drill;
  }

  async getRecoveryDrill(id: string) {
    const item = await this.prisma.recoveryDrill.findUnique({ where: { id }, include: { performedBy: { select: { id: true, email: true, fullName: true } } } });
    if (!item) throw new NotFoundException('Recovery drill nu a fost gasit.');
    return item;
  }

  async updateRecoveryDrill(id: string, dto: UpdateRecoveryDrillDto) {
    await this.getRecoveryDrill(id);
    return this.prisma.recoveryDrill.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        status: dto.status,
        resultSummary: dto.resultSummary,
        issuesFound: dto.issuesFound as Prisma.InputJsonValue | undefined,
        actionsTaken: dto.actionsTaken as Prisma.InputJsonValue | undefined,
        nextActions: dto.nextActions as Prisma.InputJsonValue | undefined,
        notes: dto.notes,
      },
    });
  }

  async startRecoveryDrill(id: string, actor?: Actor) {
    await this.getRecoveryDrill(id);
    const drill = await this.prisma.recoveryDrill.update({
      where: { id },
      data: { status: RecoveryDrillStatus.IN_PROGRESS, startedAt: new Date(), performedById: this.actorId(actor) },
    });
    await this.audit('RECOVERY_DRILL_STARTED', 'RecoveryDrill', drill.id, `Recovery drill pornit: ${drill.title}`, actor, { scope: drill.scope });
    return drill;
  }

  async completeRecoveryDrill(id: string, dto: CompleteRecoveryDrillDto, actor?: Actor) {
    if (!([RecoveryDrillStatus.PASSED, RecoveryDrillStatus.PARTIAL, RecoveryDrillStatus.FAILED, RecoveryDrillStatus.CANCELLED] as RecoveryDrillStatus[]).includes(dto.status)) {
      throw new BadRequestException('Statusul de finalizare nu este valid.');
    }
    await this.getRecoveryDrill(id);
    const drill = await this.prisma.recoveryDrill.update({
      where: { id },
      data: {
        status: dto.status,
        completedAt: new Date(),
        durationMinutes: dto.durationMinutes,
        resultSummary: dto.resultSummary,
        issuesFound: dto.issuesFound as Prisma.InputJsonValue | undefined,
        actionsTaken: dto.actionsTaken as Prisma.InputJsonValue | undefined,
        nextActions: dto.nextActions as Prisma.InputJsonValue | undefined,
      },
    });
    await this.audit(dto.status === RecoveryDrillStatus.FAILED ? 'RECOVERY_DRILL_FAILED' : 'RECOVERY_DRILL_COMPLETED', 'RecoveryDrill', drill.id, `Recovery drill finalizat: ${drill.title}`, actor, { status: drill.status, scope: drill.scope });
    return drill;
  }

  async incidents() {
    return this.prisma.productionIncident.findMany({
      include: { assignedTo: { select: { id: true, email: true, fullName: true } }, openedBy: { select: { id: true, email: true, fullName: true } } },
      orderBy: { startedAt: 'desc' },
    });
  }

  async createIncident(dto: CreateProductionIncidentDto, actor?: Actor) {
    const incident = await this.prisma.productionIncident.create({
      data: {
        title: dto.title.trim(),
        description: dto.description.trim(),
        severity: dto.severity,
        affectedServices: (dto.affectedServices || []) as Prisma.InputJsonValue,
        startedAt: dto.startedAt ? new Date(dto.startedAt) : new Date(),
        detectedAt: new Date(),
        openedById: this.actorId(actor),
        assignedToId: dto.assignedToId || null,
      },
    });
    await this.prisma.productionIncidentUpdate.create({
      data: { incidentId: incident.id, actorUserId: this.actorId(actor), status: incident.status, message: 'Incident creat.' },
    });
    await this.audit('PRODUCTION_INCIDENT_CREATED', 'ProductionIncident', incident.id, `Incident production creat: ${incident.title}`, actor, { severity: incident.severity, status: incident.status });
    return incident;
  }

  async getIncident(id: string) {
    const incident = await this.prisma.productionIncident.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { id: true, email: true, fullName: true } },
        openedBy: { select: { id: true, email: true, fullName: true } },
        updates: { include: { actor: { select: { id: true, email: true, fullName: true } } }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!incident) throw new NotFoundException('Incidentul nu a fost gasit.');
    return incident;
  }

  async updateIncident(id: string, dto: UpdateProductionIncidentDto, actor?: Actor) {
    await this.getIncident(id);
    const now = new Date();
    const incident = await this.prisma.productionIncident.update({
      where: { id },
      data: {
        status: dto.status,
        severity: dto.severity,
        rootCause: dto.rootCause,
        resolutionSummary: dto.resolutionSummary,
        nextActions: dto.nextActions as Prisma.InputJsonValue | undefined,
        assignedToId: dto.assignedToId,
        mitigatedAt: dto.status === ProductionIncidentStatus.MITIGATED ? now : undefined,
        resolvedAt: dto.status === ProductionIncidentStatus.RESOLVED ? now : undefined,
        closedAt: dto.status === ProductionIncidentStatus.CLOSED ? now : undefined,
      },
    });
    if (dto.status) {
      await this.prisma.productionIncidentUpdate.create({
        data: { incidentId: id, actorUserId: this.actorId(actor), status: dto.status, message: `Status schimbat la ${dto.status}.` },
      });
    }
    await this.audit(dto.status === ProductionIncidentStatus.RESOLVED ? 'PRODUCTION_INCIDENT_RESOLVED' : 'PRODUCTION_INCIDENT_UPDATED', 'ProductionIncident', incident.id, `Incident production actualizat: ${incident.title}`, actor, { severity: incident.severity, status: incident.status });
    return incident;
  }

  async addIncidentUpdate(id: string, dto: IncidentUpdateDto, actor?: Actor) {
    await this.getIncident(id);
    const update = await this.prisma.productionIncidentUpdate.create({
      data: { incidentId: id, actorUserId: this.actorId(actor), status: dto.status || null, message: dto.message.trim() },
    });
    if (dto.status) await this.updateIncident(id, { status: dto.status }, actor);
    return update;
  }

  async exportCenter() {
    return {
      items: this.exportCenterItems(),
      note: 'Exporturile sunt administrative si nu includ parole, tokenuri sau secrete. Dump-urile DB nu se stocheaza in aplicatie.',
    };
  }

  private async calculateReadiness(input: { checklist: any[]; services: any[]; backupChecks: any[]; runbooks: any[]; incidents: any[]; criticalErrors: number }) {
    let score = 100;
    let warnings = 0;
    let criticalBlockers = 0;
    const hasDatabaseBackup = input.backupChecks.some((item) => item.scope === BackupScope.DATABASE && [BackupCheckStatus.PASSED, BackupCheckStatus.WARNING].includes(item.status));
    const restoreTested = input.backupChecks.some((item) => item.scope === BackupScope.DATABASE && item.restoreTested);
    const inactiveCriticalServices = input.services.filter((item) => item.criticality === PlatformServiceCriticality.CRITICAL && ![PlatformServiceStatus.ACTIVE, PlatformServiceStatus.TRIAL].includes(item.status));
    const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
    const openCriticalIncidents = input.incidents.filter((item) => item.severity === ProductionIncidentSeverity.CRITICAL && ![ProductionIncidentStatus.RESOLVED, ProductionIncidentStatus.CLOSED].includes(item.status));
    const monitoringOk = await this.checkDb();

    if (!hasDatabaseBackup) { score -= 20; criticalBlockers += 1; }
    if (!restoreTested) { score -= 15; warnings += 1; }
    score -= inactiveCriticalServices.length * 15;
    criticalBlockers += inactiveCriticalServices.length;
    score -= missingEnv.length * 10;
    criticalBlockers += missingEnv.length;
    if (input.runbooks.length === 0) { score -= 10; warnings += 1; }
    if (!monitoringOk) { score -= 10; criticalBlockers += 1; }
    score -= openCriticalIncidents.length * 20;
    criticalBlockers += openCriticalIncidents.length;
    warnings += input.checklist.filter((item) => item.status === BackupCheckStatus.WARNING).length + input.criticalErrors;
    score -= warnings * 5;
    score = Math.max(0, Math.min(100, score));
    const status = score >= 90 && criticalBlockers === 0 && restoreTested ? 'VERIFIED' : score >= 90 ? 'READY' : score >= 70 ? 'PARTIALLY_READY' : score >= 40 ? 'NEEDS_ATTENTION' : 'NOT_CONFIGURED';
    return { status, score, criticalBlockers, warnings };
  }

  private databaseSummary(checks: any[], dbStatus: BackupCheckStatus) {
    const latest = checks.find((item) => item.scope === BackupScope.DATABASE);
    return {
      lastBackupCheckAt: latest?.checkedAt || null,
      restoreTested: checks.some((item) => item.scope === BackupScope.DATABASE && item.restoreTested),
      status: dbStatus,
    };
  }

  private serviceSummary(services: any[]) {
    const critical = services.filter((item) => item.criticality === PlatformServiceCriticality.CRITICAL || CRITICAL_SERVICE_TYPES.includes(item.type));
    const now = new Date();
    const seven = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return {
      criticalServices: critical.length,
      criticalActive: critical.filter((item) => [PlatformServiceStatus.ACTIVE, PlatformServiceStatus.TRIAL].includes(item.status)).length,
      pastDue: services.filter((item) => item.status === PlatformServiceStatus.PAST_DUE || (item.nextPaymentDate && item.nextPaymentDate < now)).length,
      dueSoon: services.filter((item) => item.nextPaymentDate && item.nextPaymentDate >= now && item.nextPaymentDate <= seven).length,
      items: critical,
    };
  }

  private async safeDbStatus() {
    return (await this.checkDb()) ? BackupCheckStatus.PASSED : BackupCheckStatus.FAILED;
  }

  private async checkDb() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private recoveryServices() {
    return this.prisma.platformService.findMany({
      where: { type: { in: [PlatformServiceType.DATABASE, PlatformServiceType.HOSTING_BACKEND, PlatformServiceType.HOSTING_FRONTEND, PlatformServiceType.DOMAIN, PlatformServiceType.DNS, PlatformServiceType.MONITORING, PlatformServiceType.SOURCE_CONTROL] } },
      orderBy: [{ criticality: 'asc' }, { name: 'asc' }],
    });
  }

  private mapBackupCheckDto(dto: UpsertBackupCheckDto, actor?: Actor): Prisma.BackupCheckUncheckedCreateInput {
    return {
      scope: dto.scope,
      status: dto.status,
      title: dto.title.trim(),
      description: dto.description.trim(),
      providerName: dto.providerName?.trim() || null,
      checkedAt: dto.checkedAt ? new Date(dto.checkedAt) : new Date(),
      checkedById: this.actorId(actor),
      backupLocation: this.safeText(dto.backupLocation),
      backupReference: this.safeText(dto.backupReference),
      backupDate: dto.backupDate ? new Date(dto.backupDate) : null,
      restoreTested: Boolean(dto.restoreTested),
      restoreTestedAt: dto.restoreTestedAt ? new Date(dto.restoreTestedAt) : null,
      notes: this.safeText(dto.notes),
    };
  }

  private safeText(value?: string) {
    if (!value) return null;
    return value
      .replace(/postgres:\/\/[^\s]+/gi, 'postgres://***')
      .replace(/(password|token|secret|api[_-]?key)=([^&\s]+)/gi, '$1=***')
      .slice(0, 3000);
  }

  private groupChecklist(items: any[]) {
    const categories = Array.from(new Set(items.map((item) => item.category)));
    return categories.map((category) => ({ category, items: items.filter((item) => item.category === category) }));
  }

  private groupChecklistSummary(items: any[]) {
    return this.groupChecklist(items).map((group) => ({
      category: group.category,
      total: group.items.length,
      passed: group.items.filter((item) => item.status === BackupCheckStatus.PASSED || item.status === BackupCheckStatus.NOT_APPLICABLE).length,
      failed: group.items.filter((item) => item.status === BackupCheckStatus.FAILED).length,
      warnings: group.items.filter((item) => item.status === BackupCheckStatus.WARNING).length,
    }));
  }

  private criticalDataMap() {
    return [
      { name: 'Apartamente', reason: 'Baza pentru facturare si alocarea locatarilor.' },
      { name: 'Locatari si contacte', reason: 'Acces portal, notificari si responsabilitati.' },
      { name: 'Facturi interne', reason: 'Solduri, obligatii lunare si istoric financiar.' },
      { name: 'Plati', reason: 'Reconciliere si solduri.' },
      { name: 'Contoare si indici', reason: 'Consum lunar si facturare corecta.' },
      { name: 'Solicitari si anunturi', reason: 'Comunicare operationala cu locatarii.' },
      { name: 'Audit log', reason: 'Trasabilitate pentru actiuni sensibile.' },
      { name: 'SaaS subscriptions/invoices', reason: 'Facturarea Espace catre APC.' },
    ];
  }

  private exportCenterItems() {
    return EXPORT_CENTER_ITEMS.map(([fileName, title, description]) => ({ fileName, title, description, available: false, message: 'Placeholder controlat pentru export recovery viitor.' }));
  }

  private async audit(action: string, entityType: string, entityId: string, description: string, actor?: Actor, metadata?: unknown) {
    const userId = this.actorId(actor);
    if (!userId) return;
    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          organizationId: actor?.organizationId || null,
          action,
          entityType,
          entityId,
          description,
          newValuesJson: (metadata || {}) as Prisma.InputJsonValue,
        },
      });
    } catch {
      // Audit must never break backup/recovery control actions.
    }
  }
}
