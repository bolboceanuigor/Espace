import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SubscriptionAccessGuard } from '../subscription/subscription-access.guard';
import { VotesController } from './votes.controller';
import { VotesService } from './votes.service';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [VotesController],
  providers: [VotesService, SubscriptionAccessGuard],
})
export class VotesModule {}
