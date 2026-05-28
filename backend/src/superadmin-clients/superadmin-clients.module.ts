import { Module } from '@nestjs/common';
import { SaasBillingModule } from '../saas-billing/saas-billing.module';
import { SaasUsageModule } from '../saas-usage/saas-usage.module';
import { ClientHealthController } from './client-health.controller';
import { ClientHealthService } from './client-health.service';
import { ClientRiskService } from './client-risk.service';
import { CustomerSuccessAnalyticsService } from './customer-success-analytics.service';
import { CustomerSuccessController } from './customer-success.controller';
import { CustomerSuccessReportsController } from './customer-success-reports.controller';
import { CustomerSuccessService } from './customer-success.service';
import { RevenueForecastController } from './revenue-forecast.controller';
import { RevenueForecastService } from './revenue-forecast.service';
import { RevenueOperationsController } from './revenue-operations.controller';
import { RevenueOperationsService } from './revenue-operations.service';
import { RetentionController } from './retention.controller';
import { RetentionService } from './retention.service';
import { SuperadminClientsController } from './superadmin-clients.controller';
import { SuperadminClientsService } from './superadmin-clients.service';
import { SuperadminKnowledgeController } from './superadmin-knowledge.controller';

@Module({
  imports: [SaasUsageModule, SaasBillingModule],
  controllers: [SuperadminClientsController, SuperadminKnowledgeController, ClientHealthController, CustomerSuccessController, CustomerSuccessReportsController, RevenueOperationsController, RevenueForecastController, RetentionController],
  providers: [SuperadminClientsService, ClientRiskService, ClientHealthService, CustomerSuccessService, CustomerSuccessAnalyticsService, RevenueOperationsService, RevenueForecastService, RetentionService],
  exports: [SuperadminClientsService, ClientRiskService, ClientHealthService, CustomerSuccessService, CustomerSuccessAnalyticsService, RevenueOperationsService, RevenueForecastService, RetentionService],
})
export class SuperadminClientsModule {}
