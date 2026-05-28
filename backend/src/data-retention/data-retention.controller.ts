import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { SuperAdminGuard } from '../auth/guards/superadmin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { DataRetentionService } from './data-retention.service';
import {
  ArchiveEntityDto,
  CreateDeletionRequestDto,
  CreateLegalHoldDto,
  ReleaseLegalHoldDto,
  RestoreArchiveDto,
  UpdateDeletionRequestStatusDto,
  UpdateRetentionPolicyDto,
} from './dto/data-retention.dto';

@Controller('api/superadmin/data-retention')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class SuperadminDataRetentionController {
  constructor(private readonly service: DataRetentionService) {}

  @Get()
  overview() {
    return this.service.overview();
  }

  @Get('policies')
  policies(@Query() query: Record<string, string | undefined>) {
    return this.service.policies(query);
  }

  @Get('policies/:id')
  policy(@Param('id') id: string) {
    return this.service.policy(id);
  }

  @Patch('policies/:id')
  updatePolicy(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateRetentionPolicyDto) {
    return this.service.updatePolicy(id, dto, user);
  }

  @Get('archive')
  archive(@Query() query: Record<string, string | undefined>) {
    return this.service.archiveList(query);
  }

  @Get('archive/:id')
  archiveRecord(@Param('id') id: string) {
    return this.service.archiveRecord(id);
  }

  @Post('archive/:id/restore')
  restore(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: RestoreArchiveDto) {
    return this.service.restoreArchive(id, dto, user);
  }

  @Get('legal-holds')
  legalHolds(@Query() query: Record<string, string | undefined>) {
    return this.service.legalHolds(query);
  }

  @Post('legal-holds')
  createLegalHold(@CurrentUser() user: any, @Body() dto: CreateLegalHoldDto) {
    return this.service.createLegalHold(dto, user);
  }

  @Patch('legal-holds/:id/release')
  releaseLegalHold(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: ReleaseLegalHoldDto) {
    return this.service.releaseLegalHold(id, dto, user);
  }

  @Get('deletion-requests')
  deletionRequests(@Query() query: Record<string, string | undefined>) {
    return this.service.deletionRequests(query);
  }

  @Post('deletion-requests')
  createDeletionRequest(@CurrentUser() user: any, @Body() dto: CreateDeletionRequestDto) {
    return this.service.createDeletionRequest(dto, user);
  }

  @Get('deletion-requests/:id')
  deletionRequest(@Param('id') id: string) {
    return this.service.deletionRequest(id);
  }

  @Patch('deletion-requests/:id/status')
  updateDeletionRequestStatus(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateDeletionRequestStatusDto) {
    return this.service.updateDeletionRequestStatus(id, dto, user);
  }
}

@Controller('api/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminDataRetentionController {
  constructor(private readonly service: DataRetentionService) {}

  @Get('archive')
  archive(@CurrentUser() user: any, @Query() query: Record<string, string | undefined>) {
    return this.service.archiveList(query, user.organizationId);
  }

  @Get('archive/:id')
  archiveRecord(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.archiveRecord(id, user.organizationId);
  }

  @Post('archive/:archiveRecordId/restore')
  restore(@CurrentUser() user: any, @Param('archiveRecordId') archiveRecordId: string, @Body() dto: RestoreArchiveDto) {
    return this.service.restoreArchive(archiveRecordId, dto, user, user.organizationId);
  }

  @Post('archive/:entityType/:entityId')
  archiveEntity(@CurrentUser() user: any, @Param('entityType') entityType: string, @Param('entityId') entityId: string, @Body() dto: ArchiveEntityDto) {
    return this.service.archiveEntity(entityType, entityId, dto, user, user.organizationId);
  }

  @Get('settings/data-retention')
  settings(@CurrentUser() user: any) {
    return this.service.adminSettings(user.organizationId);
  }
}
