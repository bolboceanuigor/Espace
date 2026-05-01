import { Module } from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { ReservationsController } from './reservations.controller';
import { ReservationsRepository } from './reservations.repository';
import { EventsModule } from '../events/events.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { CalendarModule } from '../calendar/calendar.module';
import { ActivityModule } from '../activity/activity.module';
import { CleaningsModule } from '../cleanings/cleanings.module';

@Module({
  imports: [EventsModule, SubscriptionModule, CalendarModule, ActivityModule, CleaningsModule],
  controllers: [ReservationsController],
  providers: [ReservationsRepository, ReservationsService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
