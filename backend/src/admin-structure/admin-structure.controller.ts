import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminStructureService } from './admin-structure.service';
import { SubscriptionAccessGuard } from '../subscription/subscription-access.guard';
import { AllowsPastDue, RequiresActiveSubscription } from '../subscription/subscription-access.decorator';
import {
  CreateApartmentDto,
  CreateBuildingDto,
  CreateResidentDto,
  CreateStaircaseDto,
  ListApartmentsQueryDto,
  ListResidentsQueryDto,
  UpdateApartmentDto,
  UpdateBuildingDto,
  UpdateResidentDto,
  UpdateStaircaseDto,
} from './dto/admin-structure.dto';

@Controller('api/admin')
@UseGuards(JwtAuthGuard, RolesGuard, SubscriptionAccessGuard)
@Roles(Role.ADMIN)
export class AdminStructureController {
  constructor(private readonly service: AdminStructureService) {}

  @Get('buildings')
  @AllowsPastDue()
  listBuildings(@CurrentUser() user: any) {
    return this.service.listBuildings(user);
  }

  @Post('buildings')
  @RequiresActiveSubscription()
  createBuilding(@CurrentUser() user: any, @Body() dto: CreateBuildingDto) {
    return this.service.createBuilding(user, dto);
  }

  @Get('buildings/:id')
  @AllowsPastDue()
  getBuilding(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.getBuilding(user, id);
  }

  @Patch('buildings/:id')
  @RequiresActiveSubscription()
  updateBuilding(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateBuildingDto) {
    return this.service.updateBuilding(user, id, dto);
  }

  @Delete('buildings/:id')
  @RequiresActiveSubscription()
  deleteBuilding(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.deleteBuilding(user, id);
  }

  @Get('buildings/:buildingId/staircases')
  @AllowsPastDue()
  listStaircases(@CurrentUser() user: any, @Param('buildingId') buildingId: string) {
    return this.service.listStaircases(user, buildingId);
  }

  @Post('buildings/:buildingId/staircases')
  @RequiresActiveSubscription()
  createStaircase(@CurrentUser() user: any, @Param('buildingId') buildingId: string, @Body() dto: CreateStaircaseDto) {
    return this.service.createStaircase(user, buildingId, dto);
  }

  @Patch('staircases/:id')
  @RequiresActiveSubscription()
  updateStaircase(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateStaircaseDto) {
    return this.service.updateStaircase(user, id, dto);
  }

  @Delete('staircases/:id')
  @RequiresActiveSubscription()
  deleteStaircase(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.deleteStaircase(user, id);
  }

  @Get('apartments')
  @AllowsPastDue()
  listApartments(@CurrentUser() user: any, @Query() query: ListApartmentsQueryDto) {
    return this.service.listApartments(user, query);
  }

  @Post('apartments')
  @RequiresActiveSubscription()
  createApartment(@CurrentUser() user: any, @Body() dto: CreateApartmentDto) {
    return this.service.createApartment(user, dto);
  }

  @Patch('apartments/:id')
  @RequiresActiveSubscription()
  updateApartment(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateApartmentDto) {
    return this.service.updateApartment(user, id, dto);
  }

  @Delete('apartments/:id')
  @RequiresActiveSubscription()
  deleteApartment(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.deleteApartment(user, id);
  }

  @Get('residents')
  @AllowsPastDue()
  listResidents(@CurrentUser() user: any, @Query() query: ListResidentsQueryDto) {
    return this.service.listResidents(user, query);
  }

  @Get('resident-profiles')
  @AllowsPastDue()
  listResidentProfiles(@CurrentUser() user: any, @Query() query: ListResidentsQueryDto) {
    return this.service.listResidents(user, query);
  }

  @Post('residents')
  @RequiresActiveSubscription()
  createResident(@CurrentUser() user: any, @Body() dto: CreateResidentDto) {
    return this.service.createResident(user, dto);
  }

  @Post('resident-profiles')
  @RequiresActiveSubscription()
  createResidentProfile(@CurrentUser() user: any, @Body() dto: CreateResidentDto) {
    return this.service.createResident(user, dto);
  }

  @Patch('residents/:id')
  @RequiresActiveSubscription()
  updateResident(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateResidentDto) {
    return this.service.updateResident(user, id, dto);
  }

  @Patch('resident-profiles/:id')
  @RequiresActiveSubscription()
  updateResidentProfile(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateResidentDto) {
    return this.service.updateResident(user, id, dto);
  }

  @Delete('residents/:id')
  @RequiresActiveSubscription()
  deleteResident(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.deleteResident(user, id);
  }

  @Delete('resident-profiles/:id')
  @RequiresActiveSubscription()
  deleteResidentProfile(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.deleteResident(user, id);
  }
}
