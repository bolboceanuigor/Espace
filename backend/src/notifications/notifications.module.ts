import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { EmailModule } from '../email/email.module';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { SuperadminNotificationsController } from './superadmin-notifications.controller';
import { SuperadminNotificationsService } from './superadmin-notifications.service';
import { TransactionalNotificationsService } from './transactional-notifications.service';

@Module({
  imports: [PrismaModule, EmailModule, AuditModule],
  controllers: [NotificationsController, SuperadminNotificationsController],
  providers: [NotificationsService, SuperadminNotificationsService, TransactionalNotificationsService],
  exports: [NotificationsService, SuperadminNotificationsService, TransactionalNotificationsService],
})
export class NotificationsModule {}
