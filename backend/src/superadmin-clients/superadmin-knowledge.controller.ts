import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SuperadminClientsService } from './superadmin-clients.service';

@Controller('api/superadmin/knowledge')
@UseGuards(RolesGuard)
@Roles(Role.SUPERADMIN)
export class SuperadminKnowledgeController {
  constructor(private readonly service: SuperadminClientsService) {}

  @Get()
  list(@Query() query: Record<string, string | undefined>) {
    return this.service.listKnowledge(query);
  }

  @Get('search')
  search(@Query() query: Record<string, string | undefined>) {
    return this.service.listKnowledge(query);
  }

  @Get('files')
  files(@Query() query: Record<string, string | undefined>) {
    return this.service.globalFiles(query);
  }

  @Get('decisions')
  decisions(@Query() query: Record<string, string | undefined>) {
    return this.service.globalDecisions(query);
  }

  @Get('known-issues')
  knownIssues(@Query() query: Record<string, string | undefined>) {
    return this.service.globalKnownIssues(query);
  }
}
