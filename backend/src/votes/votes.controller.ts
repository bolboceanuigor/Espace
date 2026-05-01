import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AllowsPastDue, RequiresActiveSubscription } from '../subscription/subscription-access.decorator';
import { SubscriptionAccessGuard } from '../subscription/subscription-access.guard';
import { AddVoteOptionDto, CastVoteDto, CreateVoteSessionDto, ListVoteSessionsDto, UpdateVoteSessionDto } from './dto/votes.dto';
import { VotesService } from './votes.service';

@Controller('api')
export class VotesController {
  constructor(private readonly votesService: VotesService) {}

  @Get('admin/votes')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsPastDue()
  adminList(@CurrentUser() user: any, @Query() query: ListVoteSessionsDto) {
    return this.votesService.adminList(user, query);
  }

  @Post('admin/votes')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  adminCreate(@CurrentUser() user: any, @Body() dto: CreateVoteSessionDto) {
    return this.votesService.adminCreate(user, dto);
  }

  @Get('admin/votes/:id')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsPastDue()
  adminGetOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.votesService.adminGetOne(user, id);
  }

  @Patch('admin/votes/:id')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  adminUpdate(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateVoteSessionDto) {
    return this.votesService.adminUpdate(user, id, dto);
  }

  @Post('admin/votes/:id/options')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  adminAddOption(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: AddVoteOptionDto) {
    return this.votesService.adminAddOption(user, id, dto);
  }

  @Post('admin/votes/:id/activate')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  adminActivate(@CurrentUser() user: any, @Param('id') id: string) {
    return this.votesService.adminActivate(user, id);
  }

  @Post('admin/votes/:id/close')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  adminClose(@CurrentUser() user: any, @Param('id') id: string) {
    return this.votesService.adminClose(user, id);
  }

  @Post('admin/votes/:id/publish')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  adminPublish(@CurrentUser() user: any, @Param('id') id: string) {
    return this.votesService.adminPublish(user, id);
  }

  @Get('admin/votes/:id/results')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsPastDue()
  adminResults(@CurrentUser() user: any, @Param('id') id: string) {
    return this.votesService.adminResults(user, id);
  }

  @Get('resident/votes')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT, Role.TENANT)
  residentList(@CurrentUser() user: any) {
    return this.votesService.residentList(user);
  }

  @Get('resident/votes/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT, Role.TENANT)
  residentGetOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.votesService.residentGetOne(user, id);
  }

  @Post('resident/votes/:id/cast')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT, Role.TENANT)
  residentCast(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: CastVoteDto) {
    return this.votesService.residentCast(user, id, dto);
  }

  @Get('superadmin/votes/overview')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN, Role.SUPER_ADMIN)
  superadminOverview(@CurrentUser() user: any) {
    return this.votesService.superadminOverview(user);
  }
}
