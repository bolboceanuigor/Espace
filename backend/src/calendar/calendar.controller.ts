import { BadRequestException, Controller, Get, Query, Req } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { Request } from 'express';
import { getOrgId } from '../common/org-scope';

@Controller()
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get('api/calendar')
  getCalendar(
    @CurrentUser() user: any,
    @Query('start') start: string,
    @Query('end') end: string,
    @Query('status') status: string | undefined,
    @Query('source') source: string | undefined,
    @Query('propertyId') propertyId: string | undefined,
    @Query('groupId') groupId: string | undefined,
    @Req() req: Request,
  ) {
    if (!start || !end) {
      throw new BadRequestException('start and end query params are required (YYYY-MM-DD)');
    }

    const organizationId = getOrgId(user, req);
    return this.calendarService.getCalendarRange({
      organizationId,
      userId: user.id ?? user.sub,
      role: user.role,
      start,
      end,
      status,
      source,
      propertyId,
      groupId,
    });
  }

  // Backward-compatible endpoint for old frontend code.
  @Get('calendar')
  getCalendarLegacy(
    @CurrentUser() user: any,
    @Query('startDate') startDate: string,
    @Query('days') days: string | undefined,
    @Req() req: Request,
  ) {
    const organizationId = getOrgId(user, req);
    return this.calendarService.getCalendarLegacy({
      organizationId,
      userId: user.id ?? user.sub,
      role: user.role,
      startDate,
      days,
    });
  }
}
