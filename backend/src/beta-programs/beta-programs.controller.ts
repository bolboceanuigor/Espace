import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { BetaCohortStatus, BetaProgramStatus, Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { MvpAuthGuard, MvpRolesGuard } from '../security/mvp-auth.guard';
import {
  AddBetaCohortMemberDto,
  CreateBetaCohortDto,
  CreateBetaProgramDto,
  ListBetaFeedbackDto,
  ListBetaProgramsDto,
  SubmitBetaFeedbackDto,
  UpdateBetaCohortDto,
  UpdateBetaCohortMemberDto,
  UpdateBetaCohortStatusDto,
  UpdateBetaFeedbackDto,
  UpdateBetaProgramDto,
  UpdateBetaProgramStatusDto,
} from './dto/beta-programs.dto';
import { BetaProgramsService } from './beta-programs.service';

@Controller('api')
@UseGuards(MvpAuthGuard, MvpRolesGuard)
export class BetaProgramsController {
  constructor(private readonly service: BetaProgramsService) {}

  @Roles(Role.SUPERADMIN, Role.ADMIN, Role.RESIDENT)
  @Get('beta/my-access')
  myAccess(@CurrentUser() user: any) {
    return this.service.myAccess(user);
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN, Role.RESIDENT)
  @Post('beta/feedback')
  submitFeedback(@CurrentUser() user: any, @Body() body: SubmitBetaFeedbackDto) {
    return this.service.submitFeedback(user, body);
  }

  @Roles(Role.SUPERADMIN)
  @Get('superadmin/beta/dashboard')
  dashboard() {
    return this.service.dashboard();
  }

  @Roles(Role.SUPERADMIN)
  @Get('superadmin/beta/programs')
  listPrograms(@Query() query: ListBetaProgramsDto) {
    return this.service.listPrograms(query);
  }

  @Roles(Role.SUPERADMIN)
  @Post('superadmin/beta/programs')
  createProgram(@CurrentUser() user: any, @Body() body: CreateBetaProgramDto) {
    return this.service.createProgram(user, body);
  }

  @Roles(Role.SUPERADMIN)
  @Get('superadmin/beta/programs/:id')
  getProgram(@Param('id') id: string) {
    return this.service.getProgram(id);
  }

  @Roles(Role.SUPERADMIN)
  @Patch('superadmin/beta/programs/:id')
  updateProgram(@CurrentUser() user: any, @Param('id') id: string, @Body() body: UpdateBetaProgramDto) {
    return this.service.updateProgram(user, id, body);
  }

  @Roles(Role.SUPERADMIN)
  @Patch('superadmin/beta/programs/:id/status')
  updateProgramStatus(@CurrentUser() user: any, @Param('id') id: string, @Body() body: UpdateBetaProgramStatusDto) {
    return this.service.updateProgramStatus(user, id, body.status as BetaProgramStatus);
  }

  @Roles(Role.SUPERADMIN)
  @Post('superadmin/beta/programs/:id/cohorts')
  createCohort(@CurrentUser() user: any, @Param('id') id: string, @Body() body: CreateBetaCohortDto) {
    return this.service.createCohort(user, id, body);
  }

  @Roles(Role.SUPERADMIN)
  @Patch('superadmin/beta/cohorts/:cohortId')
  updateCohort(@CurrentUser() user: any, @Param('cohortId') cohortId: string, @Body() body: UpdateBetaCohortDto) {
    return this.service.updateCohort(user, cohortId, body);
  }

  @Roles(Role.SUPERADMIN)
  @Patch('superadmin/beta/cohorts/:cohortId/status')
  updateCohortStatus(@CurrentUser() user: any, @Param('cohortId') cohortId: string, @Body() body: UpdateBetaCohortStatusDto) {
    return this.service.updateCohortStatus(user, cohortId, body.status as BetaCohortStatus);
  }

  @Roles(Role.SUPERADMIN)
  @Post('superadmin/beta/cohorts/:cohortId/members')
  addMember(@CurrentUser() user: any, @Param('cohortId') cohortId: string, @Body() body: AddBetaCohortMemberDto) {
    return this.service.addMember(user, cohortId, body);
  }

  @Roles(Role.SUPERADMIN)
  @Patch('superadmin/beta/cohorts/:cohortId/members/:memberId')
  updateMember(@CurrentUser() user: any, @Param('cohortId') cohortId: string, @Param('memberId') memberId: string, @Body() body: UpdateBetaCohortMemberDto) {
    return this.service.updateMember(user, cohortId, memberId, body);
  }

  @Roles(Role.SUPERADMIN)
  @Delete('superadmin/beta/cohorts/:cohortId/members/:memberId')
  removeMember(@CurrentUser() user: any, @Param('cohortId') cohortId: string, @Param('memberId') memberId: string) {
    return this.service.removeMember(user, cohortId, memberId);
  }

  @Roles(Role.SUPERADMIN)
  @Get('superadmin/beta/feedback')
  listFeedback(@Query() query: ListBetaFeedbackDto) {
    return this.service.listFeedback(query);
  }

  @Roles(Role.SUPERADMIN)
  @Patch('superadmin/beta/feedback/:id')
  updateFeedback(@CurrentUser() user: any, @Param('id') id: string, @Body() body: UpdateBetaFeedbackDto) {
    return this.service.updateFeedback(user, id, body);
  }
}
