import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { FeedbackService } from './feedback.service';
import { ConvertFeedbackToFeatureDto, UpdateFeedbackDto } from './dto/update-feedback.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller(['superadmin/feedback', 'api/superadmin/feedback'])
@UseGuards(RolesGuard)
@Roles(Role.SUPERADMIN)
export class SuperadminFeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: any) {
    return this.feedbackService.dashboardForSuperadmin(user);
  }

  @Get()
  list(
    @Query('organizationId') organizationId?: string,
    @Query('type') type?: 'BUG' | 'IDEA' | 'QUESTION' | 'COMPLAINT',
    @Query('status') status?: 'NEW' | 'REVIEWED' | 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED',
    @Query('priority') priority?: 'LOW' | 'MEDIUM' | 'HIGH',
    @Query('linked') linked?: 'true' | 'false',
  ) {
    return this.feedbackService.listForSuperadmin({ organizationId, type, status, priority, linked });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.feedbackService.getForSuperadmin(id);
  }

  @Patch(':id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateFeedbackDto) {
    return this.feedbackService.updateBySuperadmin(id, dto, user);
  }

  @Post(':id/convert-to-feature')
  convertToFeature(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: ConvertFeedbackToFeatureDto) {
    return this.feedbackService.convertToFeatureRequest(id, dto, user);
  }
}
