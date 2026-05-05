import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminStructureService } from './admin-structure.service';
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
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminStructureController {
  constructor(private readonly service: AdminStructureService) {}

  @Get('buildings')
  listBuildings(@CurrentUser() user: any) {
    return this.service.listBuildings(user);
  }

  @Post('buildings')
  createBuilding(@CurrentUser() user: any, @Body() dto: CreateBuildingDto) {
    return this.service.createBuilding(user, dto);
  }

  @Get('buildings/:id')
  getBuilding(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.getBuilding(user, id);
  }

  @Patch('buildings/:id')
  updateBuilding(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateBuildingDto) {
    return this.service.updateBuilding(user, id, dto);
  }

  @Delete('buildings/:id')
  deleteBuilding(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.deleteBuilding(user, id);
  }

  @Get('buildings/:buildingId/staircases')
  listStaircases(@CurrentUser() user: any, @Param('buildingId') buildingId: string) {
    return this.service.listStaircases(user, buildingId);
  }

  @Post('buildings/:buildingId/staircases')
  createStaircase(@CurrentUser() user: any, @Param('buildingId') buildingId: string, @Body() dto: CreateStaircaseDto) {
    return this.service.createStaircase(user, buildingId, dto);
  }

  @Patch('staircases/:id')
  updateStaircase(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateStaircaseDto) {
    return this.service.updateStaircase(user, id, dto);
  }

  @Delete('staircases/:id')
  deleteStaircase(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.deleteStaircase(user, id);
  }

  @Get('apartments')
  listApartments(@CurrentUser() user: any, @Query() query: ListApartmentsQueryDto) {
    return this.service.listApartments(user, query);
  }

  @Post('apartments')
  createApartment(@CurrentUser() user: any, @Body() dto: CreateApartmentDto) {
    return this.service.createApartment(user, dto);
  }

  @Patch('apartments/:id')
  updateApartment(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateApartmentDto) {
    return this.service.updateApartment(user, id, dto);
  }

  @Delete('apartments/:id')
  deleteApartment(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.deleteApartment(user, id);
  }

  @Get('residents')
  listResidents(@CurrentUser() user: any, @Query() query: ListResidentsQueryDto) {
    return this.service.listResidents(user, query);
  }

  @Get('resident-profiles')
  listResidentProfiles(@CurrentUser() user: any, @Query() query: ListResidentsQueryDto) {
    return this.service.listResidents(user, query);
  }

  @Post('residents')
  createResident(@CurrentUser() user: any, @Body() dto: CreateResidentDto) {
    return this.service.createResident(user, dto);
  }

  @Post('resident-profiles')
  createResidentProfile(@CurrentUser() user: any, @Body() dto: CreateResidentDto) {
    return this.service.createResident(user, dto);
  }

  @Patch('residents/:id')
  updateResident(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateResidentDto) {
    return this.service.updateResident(user, id, dto);
  }

  @Patch('resident-profiles/:id')
  updateResidentProfile(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateResidentDto) {
    return this.service.updateResident(user, id, dto);
  }

  @Delete('residents/:id')
  deleteResident(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.deleteResident(user, id);
  }

  @Delete('resident-profiles/:id')
  deleteResidentProfile(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.deleteResident(user, id);
  }
}
