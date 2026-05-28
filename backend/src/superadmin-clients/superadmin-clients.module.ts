import { Module } from '@nestjs/common';
import { ClientHealthController } from './client-health.controller';
import { ClientHealthService } from './client-health.service';
import { ClientRiskService } from './client-risk.service';
import { CustomerSuccessAnalyticsService } from './customer-success-analytics.service';
import { CustomerSuccessController } from './customer-success.controller';
import { CustomerSuccessReportsController } from './customer-success-reports.controller';
import { CustomerSuccessService } from './customer-success.service';
import { SuperadminClientsController } from './superadmin-clients.controller';
import { SuperadminClientsService } from './superadmin-clients.service';
import { SuperadminKnowledgeController } from './superadmin-knowledge.controller';

@Module({
  controllers: [SuperadminClientsController, SuperadminKnowledgeController, ClientHealthController, CustomerSuccessController, CustomerSuccessReportsController],
  providers: [SuperadminClientsService, ClientRiskService, ClientHealthService, CustomerSuccessService, CustomerSuccessAnalyticsService],
  exports: [SuperadminClientsService, ClientRiskService, ClientHealthService, CustomerSuccessService, CustomerSuccessAnalyticsService],
})
export class SuperadminClientsModule {}
