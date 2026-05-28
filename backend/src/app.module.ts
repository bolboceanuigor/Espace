import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { ApartmentsModule } from './apartments/apartments.module';
import { ResidentsModule } from './residents/residents.module';
import { MetersModule } from './meters/meters.module';
import { BillingReadModule } from './billing-read/billing-read.module';
import { CommunityReadModule } from './community-read/community-read.module';
import { ResidentDemoModule } from './resident-demo/resident-demo.module';
import { DemoAuthReadModule } from './demo-auth-read/demo-auth-read.module';
import { MinimalAuthModule } from './minimal-auth/minimal-auth.module';
import { SaasManagementModule } from './saas-management/saas-management.module';
import { SaasBillingModule } from './saas-billing/saas-billing.module';
import { SaasUsageModule } from './saas-usage/saas-usage.module';
import { SaasUpgradesModule } from './saas-upgrades/saas-upgrades.module';
import { SaasInvoicesModule } from './saas-invoices/saas-invoices.module';
import { DocumentRenderModule } from './document-render/document-render.module';
import { OnlinePaymentsModule } from './online-payments/online-payments.module';
import { SystemMonitoringModule } from './system-monitoring/system-monitoring.module';
import { HelpModule } from './help/help.module';
import { CustomerRequestsModule } from './customer-requests/customer-requests.module';
import { LegalModule } from './legal/legal.module';
import { LaunchControlModule } from './launch-control/launch-control.module';
import { BackupRecoveryModule } from './backup-recovery/backup-recovery.module';
import { DataRetentionModule } from './data-retention/data-retention.module';
import { DataExportModule } from './data-export/data-export.module';
import { SetupModule } from './setup/setup.module';
import { MessagesMvpModule } from './messages-mvp/messages-mvp.module';
import { ActivityMvpModule } from './activity-mvp/activity-mvp.module';
import { DocumentsMvpModule } from './documents-mvp/documents-mvp.module';
import { ReportsModule } from './reports/reports.module';
import { InvitationsMvpModule } from './invitations-mvp/invitations-mvp.module';
import { AdminWorkbenchModule } from './admin-workbench/admin-workbench.module';
import { ImportsModule } from './imports/imports.module';
import { DataQualityModule } from './data-quality/data-quality.module';
import { ResidentAccessModule } from './resident-access/resident-access.module';
import { TeamModule } from './team/team.module';
import { AdminRbacModule } from './rbac/admin-rbac.module';
import { AssociationContextModule } from './association-context/association-context.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    OrganizationsModule,
    ApartmentsModule,
    ResidentsModule,
    MetersModule,
    BillingReadModule,
    CommunityReadModule,
    ResidentDemoModule,
    DemoAuthReadModule,
    MinimalAuthModule,
    SaasManagementModule,
    SaasBillingModule,
    SaasUsageModule,
    SaasUpgradesModule,
    SaasInvoicesModule,
    DocumentRenderModule,
    OnlinePaymentsModule,
    SystemMonitoringModule,
    HelpModule,
    CustomerRequestsModule,
    LegalModule,
    LaunchControlModule,
    BackupRecoveryModule,
    DataRetentionModule,
    DataExportModule,
    SetupModule,
    MessagesMvpModule,
    ActivityMvpModule,
    DocumentsMvpModule,
    ReportsModule,
    InvitationsMvpModule,
    AdminWorkbenchModule,
    ImportsModule,
    DataQualityModule,
    ResidentAccessModule,
    TeamModule,
    AdminRbacModule,
    AssociationContextModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
