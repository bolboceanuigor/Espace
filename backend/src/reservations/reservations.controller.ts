import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { ReservationsService } from './reservations.service';
import { CalendarService } from '../calendar/calendar.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { MoveReservationDto } from './dto/move-reservation.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { Request } from 'express';
import { getOrgId } from '../common/org-scope';

@Controller(['reservations', 'api/reservations'])
@UseGuards(JwtAuthGuard)
export class ReservationsController {
  constructor(
    private readonly reservationsService: ReservationsService,
    private readonly calendarService: CalendarService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  create(@Body() createReservationDto: CreateReservationDto, @CurrentUser() user: any, @Req() req: Request) {
    const userId = user.sub ?? user.id;
    const organizationId = getOrgId(user, req);
    return this.reservationsService.create(organizationId, userId, user.role, createReservationDto);
  }

  @Get()
  findAll(
    @CurrentUser() user: any,
    @Query('start') start: string | undefined,
    @Query('end') end: string | undefined,
    @Query('status') status: string | undefined,
    @Query('source') source: string | undefined,
    @Query('propertyId') propertyId: string | undefined,
    @Query('q') q: string | undefined,
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @Req() req: Request,
  ) {
    const userId = user.sub ?? user.id;
    const organizationId = getOrgId(user, req);
    return this.reservationsService.findAll(
      organizationId,
      userId,
      user.role,
      start,
      end,
      status,
      source,
      propertyId,
      q,
      page,
      pageSize,
    );
  }

  @Get('by-week')
  findByWeek(
    @CurrentUser() user: any,
    @Query('startDate') startDate: string,
    @Req() req: Request,
  ) {
    const userId = user.sub ?? user.id;
    const organizationId = getOrgId(user, req);
    return this.reservationsService.findByWeek(organizationId, userId, user.role, startDate);
  }

  @Get('calendar')
  getCalendar(
    @CurrentUser() user: any,
    @Query('startDate') startDate: string | undefined,
    @Query('days') days: string | undefined,
    @Req() req: Request,
  ) {
    const organizationId = getOrgId(user, req);
    return this.calendarService.getCalendarLegacy({
      organizationId,
      userId: user.sub ?? user.id,
      role: user.role,
      startDate,
      days,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
    const userId = user.sub ?? user.id;
    const organizationId = getOrgId(user, req);
    return this.reservationsService.findOne(id, organizationId, userId, user.role);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateReservationDto: UpdateReservationDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const userId = user.sub ?? user.id;
    const organizationId = getOrgId(user, req);
    return this.reservationsService.update(id, organizationId, user.role, userId, updateReservationDto);
  }

  @Patch(':id/move')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  move(
    @Param('id') id: string,
    @Body() moveDto: MoveReservationDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const userId = user.sub ?? user.id;
    const organizationId = getOrgId(user, req);
    return this.reservationsService.move(id, organizationId, user.role, moveDto.newCheckIn, moveDto.newCheckOut, userId);
  }

  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  cancel(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
    const userId = user.sub ?? user.id;
    const organizationId = getOrgId(user, req);
    return this.reservationsService.cancel(id, organizationId, user.role, userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  remove(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
    const userId = user.sub ?? user.id;
    const organizationId = getOrgId(user, req);
    return this.reservationsService.remove(id, organizationId, user.role, userId);
  }
}
