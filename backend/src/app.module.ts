import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { TenantModule } from './tenant/tenant.module';
import { TenantContextInterceptor } from './tenant/tenant-context.interceptor';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RequireOrganizationGuard } from './auth/guards/require-organization.guard';
import { RolesGuard } from './auth/roles.guard';
import { OrganizationScopeGuard } from './auth/guards/organization-scope.guard';
import { UsersModule } from './users/users.module';
import { AdminModule } from './admin/admin.module';
import { SalesModule } from './sales/sales.module';
import { PropertiesModule } from './properties/properties.module';
import { ClientsModule } from './clients/clients.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { ReservationsModule } from './reservations/reservations.module';
import { EventsModule } from './events/events.module';
import { CalendarModule } from './calendar/calendar.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AppController } from './app.controller';
import { ActivityModule } from './activity/activity.module';
import { ExportsModule } from './exports/exports.module';
import { TeamModule } from './team/team.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { ChannelsModule } from './channels/channels.module';
import { FeedbackModule } from './feedback/feedback.module';
import { InvitationsModule } from './invitations/invitations.module';
import { SuperadminModule } from './superadmin/superadmin.module';
import { MeModule } from './me/me.module';
import { CleaningsModule } from './cleanings/cleanings.module';
import { SettingsModule } from './settings/settings.module';
import { ManagerModule } from './manager/manager.module';
import { CondoModule } from './condo/condo.module';
import { AssociationChatModule } from './association-chat/association-chat.module';
import { RbacDashboardModule } from './rbac/rbac-dashboard.module';
import { AdminStructureModule } from './admin-structure/admin-structure.module';
import { CommunicationsModule } from './communications/communications.module';
import { IssuesModule } from './issues/issues.module';
import { VotesModule } from './votes/votes.module';
import { ReportsModule } from './reports/reports.module';
import { ImportsModule } from './imports/imports.module';
import { InvoicesModule } from './invoices/invoices.module';
import { PaymentsModule } from './payments/payments.module';
import { AuditModule } from './audit/audit.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerModule } from './scheduler/scheduler.module';
import { ReconciliationModule } from './reconciliation/reconciliation.module';
import { RemindersModule } from './reminders/reminders.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { LeadsModule } from './leads/leads.module';
import { DemoRestrictionsGuard } from './auth/guards/demo-restrictions.guard';
import { HelpModule } from './help/help.module';
import { LimitsModule } from './limits/limits.module';
import { OrganizationLimitsGuard } from './auth/guards/organization-limits.guard';
import { FilesModule } from './files/files.module';
import { PrivacyModule } from './privacy/privacy.module';
import { ChatModule } from './chat/chat.module';
import { SystemMonitoringModule } from './system-monitoring/system-monitoring.module';
import { RoadmapModule } from './roadmap/roadmap.module';
import { ReleaseNotesModule } from './release-notes/release-notes.module';
import { DemoRequestsModule } from './demo-requests/demo-requests.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 60,
      },
    ]),
    ScheduleModule.forRoot(),
    PrismaModule,
    TenantModule,
    AuthModule,
    UsersModule,
    AdminModule,
    SalesModule,
    PropertiesModule,
    ClientsModule,
    OrganizationsModule,
    SubscriptionModule,
    ReservationsModule,
    EventsModule,
    CalendarModule,
    DashboardModule,
    ActivityModule,
    ExportsModule,
    TeamModule,
    ChannelsModule,
    FeedbackModule,
    InvitationsModule,
    SuperadminModule,
    MeModule,
    CleaningsModule,
    SettingsModule,
    ManagerModule,
    CondoModule,
    AssociationChatModule,
    RbacDashboardModule,
    AdminStructureModule,
    CommunicationsModule,
    IssuesModule,
    VotesModule,
    ReportsModule,
    ImportsModule,
    InvoicesModule,
    PaymentsModule,
    AuditModule,
    MaintenanceModule,
    NotificationsModule,
    SchedulerModule,
    ReconciliationModule,
    RemindersModule,
    OnboardingModule,
    LeadsModule,
    HelpModule,
    LimitsModule,
    FilesModule,
    PrivacyModule,
    ChatModule,
    SystemMonitoringModule,
    RoadmapModule,
    ReleaseNotesModule,
    DemoRequestsModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: OrganizationScopeGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RequireOrganizationGuard,
    },
    {
      provide: APP_GUARD,
      useClass: DemoRestrictionsGuard,
    },
    {
      provide: APP_GUARD,
      useClass: OrganizationLimitsGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantContextInterceptor,
    },
  ],
})
export class AppModule {}
