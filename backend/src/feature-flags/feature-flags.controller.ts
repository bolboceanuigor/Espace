import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { FeatureFlagStatus, Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { MvpAuthGuard, MvpRolesGuard } from '../security/mvp-auth.guard';
import {
  CreateFeatureFlagDto,
  CreateFeatureFlagRuleDto,
  EvaluateFeatureFlagsDto,
  ListFeatureFlagsDto,
  PreviewFeatureFlagsDto,
  UpdateFeatureFlagDto,
  UpdateFeatureFlagRuleDto,
  UpdateFeatureFlagStatusDto,
} from './dto/feature-flags.dto';
import { FeatureFlagsService } from './feature-flags.service';

@Controller('api')
@UseGuards(MvpAuthGuard, MvpRolesGuard)
export class FeatureFlagsController {
  constructor(private readonly service: FeatureFlagsService) {}

  @Roles(Role.SUPERADMIN, Role.ADMIN, Role.RESIDENT)
  @Get('feature-flags/catalog')
  catalog() {
    return this.service.moduleCatalog();
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN, Role.RESIDENT)
  @Get('feature-flags/evaluate')
  evaluate(@CurrentUser() user: any, @Query() query: EvaluateFeatureFlagsDto) {
    return this.service.evaluateForUser(user, query);
  }

  @Roles(Role.SUPERADMIN)
  @Get('superadmin/feature-flags/catalog')
  superadminCatalog() {
    return this.service.moduleCatalog();
  }

  @Roles(Role.SUPERADMIN)
  @Get('superadmin/feature-flags/dashboard')
  dashboard() {
    return this.service.dashboard();
  }

  @Roles(Role.SUPERADMIN)
  @Post('superadmin/feature-flags/preview')
  preview(@CurrentUser() user: any, @Body() body: PreviewFeatureFlagsDto) {
    return this.service.preview(user, body);
  }

  @Roles(Role.SUPERADMIN)
  @Get('superadmin/feature-flags')
  list(@Query() query: ListFeatureFlagsDto) {
    return this.service.list(query);
  }

  @Roles(Role.SUPERADMIN)
  @Post('superadmin/feature-flags')
  create(@CurrentUser() user: any, @Body() body: CreateFeatureFlagDto) {
    return this.service.create(user, body);
  }

  @Roles(Role.SUPERADMIN)
  @Get('superadmin/feature-flags/:id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Roles(Role.SUPERADMIN)
  @Patch('superadmin/feature-flags/:id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() body: UpdateFeatureFlagDto) {
    return this.service.update(user, id, body);
  }

  @Roles(Role.SUPERADMIN)
  @Patch('superadmin/feature-flags/:id/status')
  updateStatus(@CurrentUser() user: any, @Param('id') id: string, @Body() body: UpdateFeatureFlagStatusDto) {
    return this.service.updateStatus(user, id, body.status as FeatureFlagStatus);
  }

  @Roles(Role.SUPERADMIN)
  @Post('superadmin/feature-flags/:id/rules')
  createRule(@CurrentUser() user: any, @Param('id') id: string, @Body() body: CreateFeatureFlagRuleDto) {
    return this.service.createRule(user, id, body);
  }

  @Roles(Role.SUPERADMIN)
  @Patch('superadmin/feature-flags/:id/rules/:ruleId')
  updateRule(@CurrentUser() user: any, @Param('id') id: string, @Param('ruleId') ruleId: string, @Body() body: UpdateFeatureFlagRuleDto) {
    return this.service.updateRule(user, id, ruleId, body);
  }

  @Roles(Role.SUPERADMIN)
  @Delete('superadmin/feature-flags/:id/rules/:ruleId')
  deleteRule(@CurrentUser() user: any, @Param('id') id: string, @Param('ruleId') ruleId: string) {
    return this.service.deleteRule(user, id, ruleId);
  }
}
