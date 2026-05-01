import { Module } from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { PropertiesController } from './properties.controller';
import { PropertiesRepository } from './properties.repository';
import { SubscriptionModule } from '../subscription/subscription.module';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [SubscriptionModule, ActivityModule],
  controllers: [PropertiesController],
  providers: [PropertiesRepository, PropertiesService],
  exports: [PropertiesService],
})
export class PropertiesModule {}
