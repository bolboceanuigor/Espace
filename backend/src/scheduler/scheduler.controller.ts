import { BadRequestException, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ALL_SCHEDULED_JOB_NAMES, ScheduledJobName } from './scheduler.constants';
import { SchedulerService } from './scheduler.service';

@Controller('api/superadmin/jobs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN)
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) {}

  @Get()
  list() {
    return this.schedulerService.listJobs();
  }

  @Post(':name/run')
  run(@Param('name') name: string) {
    const normalized = String(name || '').toUpperCase() as ScheduledJobName;
    if (!ALL_SCHEDULED_JOB_NAMES.includes(normalized)) {
      throw new BadRequestException('Unknown job name');
    }
    return this.schedulerService.runJobManually(normalized);
  }

  @Patch(':name/enable')
  enable(@Param('name') name: string) {
    const normalized = String(name || '').toUpperCase() as ScheduledJobName;
    if (!ALL_SCHEDULED_JOB_NAMES.includes(normalized)) {
      throw new BadRequestException('Unknown job name');
    }
    return this.schedulerService.enableJob(normalized);
  }

  @Patch(':name/disable')
  disable(@Param('name') name: string) {
    const normalized = String(name || '').toUpperCase() as ScheduledJobName;
    if (!ALL_SCHEDULED_JOB_NAMES.includes(normalized)) {
      throw new BadRequestException('Unknown job name');
    }
    return this.schedulerService.disableJob(normalized);
  }
}
