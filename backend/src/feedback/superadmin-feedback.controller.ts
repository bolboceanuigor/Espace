import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { FeedbackService } from './feedback.service';
import { UpdateFeedbackDto } from './dto/update-feedback.dto';

@Controller(['superadmin/feedback', 'api/superadmin/feedback'])
@UseGuards(RolesGuard)
@Roles(Role.SUPERADMIN)
export class SuperadminFeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Get()
  list(
    @Query('organizationId') organizationId?: string,
    @Query('type') type?: 'BUG' | 'IDEA' | 'QUESTION' | 'COMPLAINT',
    @Query('status') status?: 'NEW' | 'REVIEWED' | 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED',
    @Query('priority') priority?: 'LOW' | 'MEDIUM' | 'HIGH',
  ) {
    return this.feedbackService.listForSuperadmin({ organizationId, type, status, priority });
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFeedbackDto) {
    return this.feedbackService.updateBySuperadmin(id, dto);
  }
}

