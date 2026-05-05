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
import { OrganizationsModule } from './organizations/organizations.module';
import { EventsModule } from './events/events.module';
import { AppController } from './app.controller';
import { ThrottlerModule } from '@nestjs/throttler';
import { MeModule } from './me/me.module';
import { SettingsModule } from './settings/settings.module';
import { CondoModule } from './condo/condo.module';
import { AssociationChatModule } from './association-chat/association-chat.module';
import { AdminStructureModule } from './admin-structure/admin-structure.module';
import { CommunicationsModule } from './communications/communications.module';
import { IssuesModule } from './issues/issues.module';
import { ImportsModule } from './imports/imports.module';
import { InvoicesModule } from './invoices/invoices.module';
import { PaymentsModule } from './payments/payments.module';
import { AuditModule } from './audit/audit.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ChatModule } from './chat/chat.module';

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
    OrganizationsModule,
    EventsModule,
    MeModule,
    SettingsModule,
    CondoModule,
    AssociationChatModule,
    AdminStructureModule,
    CommunicationsModule,
    IssuesModule,
    ImportsModule,
    InvoicesModule,
    PaymentsModule,
    AuditModule,
    NotificationsModule,
    ChatModule,
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
      provide: APP_INTERCEPTOR,
      useClass: TenantContextInterceptor,
    },
  ],
})
export class AppModule {}
