import { Module } from '@nestjs/common';
import { ClientRiskService } from './client-risk.service';
import { SuperadminClientsController } from './superadmin-clients.controller';
import { SuperadminClientsService } from './superadmin-clients.service';
import { SuperadminKnowledgeController } from './superadmin-knowledge.controller';

@Module({
  controllers: [SuperadminClientsController, SuperadminKnowledgeController],
  providers: [SuperadminClientsService, ClientRiskService],
  exports: [SuperadminClientsService, ClientRiskService],
})
export class SuperadminClientsModule {}
