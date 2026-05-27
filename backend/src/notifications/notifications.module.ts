import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { TransactionalNotificationsService } from './transactional-notifications.service';

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, TransactionalNotificationsService],
  exports: [NotificationsService, TransactionalNotificationsService],
})
export class NotificationsModule {}
