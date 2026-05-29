import { Module } from '@nestjs/common';
import { ActivityMvpModule } from '../activity-mvp/activity-mvp.module';
import { InvoicePublishingService } from './invoice-publishing.service';

@Module({
  imports: [ActivityMvpModule],
  providers: [InvoicePublishingService],
  exports: [InvoicePublishingService],
})
export class InvoicePublishingModule {}
