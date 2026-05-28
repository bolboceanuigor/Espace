import { Module } from '@nestjs/common';
import { ClientHealthController } from './client-health.controller';
import { ClientHealthService } from './client-health.service';
import { ClientRiskService } from './client-risk.service';
import { CustomerSuccessController } from './customer-success.controller';
import { CustomerSuccessService } from './customer-success.service';
import { SuperadminClientsController } from './superadmin-clients.controller';
import { SuperadminClientsService } from './superadmin-clients.service';
import { SuperadminKnowledgeController } from './superadmin-knowledge.controller';

@Module({
  controllers: [SuperadminClientsController, SuperadminKnowledgeController, ClientHealthController, CustomerSuccessController],
  providers: [SuperadminClientsService, ClientRiskService, ClientHealthService, CustomerSuccessService],
  exports: [SuperadminClientsService, ClientRiskService, ClientHealthService, CustomerSuccessService],
})
export class SuperadminClientsModule {}
