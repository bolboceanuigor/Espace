import { Module } from '@nestjs/common';
import { ClientHealthController } from './client-health.controller';
import { ClientHealthService } from './client-health.service';
import { ClientRiskService } from './client-risk.service';
import { SuperadminClientsController } from './superadmin-clients.controller';
import { SuperadminClientsService } from './superadmin-clients.service';
import { SuperadminKnowledgeController } from './superadmin-knowledge.controller';

@Module({
  controllers: [SuperadminClientsController, SuperadminKnowledgeController, ClientHealthController],
  providers: [SuperadminClientsService, ClientRiskService, ClientHealthService],
  exports: [SuperadminClientsService, ClientRiskService, ClientHealthService],
})
export class SuperadminClientsModule {}
