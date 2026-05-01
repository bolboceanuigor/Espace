import { Module } from '@nestjs/common';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';
import { SuperadminFeedbackController } from './superadmin-feedback.controller';

@Module({
  controllers: [FeedbackController, SuperadminFeedbackController],
  providers: [FeedbackService],
})
export class FeedbackModule {}
