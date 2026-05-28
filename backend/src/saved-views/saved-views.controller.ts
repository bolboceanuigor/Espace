import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role, SavedViewModule } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PermissionGuard } from '../auth/permission.guard';
import { MvpAuthGuard, MvpRolesGuard, MvpUser } from '../security/mvp-auth.guard';
import { CreateSavedViewDto, ToggleSavedViewDto, UpdateModulePreferencesDto, UpdateSavedViewDto } from './dto/saved-view.dto';
import { SavedViewsService } from './saved-views.service';

@Controller()
@UseGuards(MvpAuthGuard, MvpRolesGuard, PermissionGuard)
@Roles(Role.ADMIN, Role.SUPERADMIN)
export class SavedViewsController {
  constructor(private readonly service: SavedViewsService) {}

  @Get(['admin/saved-views', 'api/admin/saved-views'])
  @RequirePermission('EXPORTS', 'VIEW')
  list(@CurrentUser() user: MvpUser, @Query() query: Record<string, string | undefined>) {
    return this.service.list(user, query);
  }

  @Post(['admin/saved-views', 'api/admin/saved-views'])
  @RequirePermission('EXPORTS', 'EXPORT')
  create(@CurrentUser() user: MvpUser, @Body() dto: CreateSavedViewDto) {
    return this.service.create(user, dto);
  }

  @Get(['admin/saved-views/:id', 'api/admin/saved-views/:id'])
  @RequirePermission('EXPORTS', 'VIEW')
  get(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.service.get(user, id);
  }

  @Patch(['admin/saved-views/:id', 'api/admin/saved-views/:id'])
  @RequirePermission('EXPORTS', 'EXPORT')
  update(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() dto: UpdateSavedViewDto) {
    return this.service.update(user, id, dto);
  }

  @Patch(['admin/saved-views/:id/archive', 'api/admin/saved-views/:id/archive'])
  @RequirePermission('EXPORTS', 'EXPORT')
  archive(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.service.archive(user, id);
  }

  @Post(['admin/saved-views/:id/duplicate', 'api/admin/saved-views/:id/duplicate'])
  @RequirePermission('EXPORTS', 'EXPORT')
  duplicate(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.service.duplicate(user, id);
  }

  @Patch(['admin/saved-views/:id/favorite', 'api/admin/saved-views/:id/favorite'])
  @RequirePermission('EXPORTS', 'EXPORT')
  favorite(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() dto: ToggleSavedViewDto) {
    return this.service.favorite(user, id, dto);
  }

  @Patch(['admin/saved-views/:id/default', 'api/admin/saved-views/:id/default'])
  @RequirePermission('EXPORTS', 'EXPORT')
  setDefault(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.service.setDefault(user, id);
  }

  @Post(['admin/saved-views/:id/use', 'api/admin/saved-views/:id/use'])
  @RequirePermission('EXPORTS', 'VIEW')
  use(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.service.markUsed(user, id);
  }

  @Get(['admin/smart-lists', 'api/admin/smart-lists'])
  @RequirePermission('EXPORTS', 'VIEW')
  smartLists(@CurrentUser() user: MvpUser, @Query() query: Record<string, string | undefined>) {
    return this.service.smartLists(user, query);
  }

  @Get(['admin/smart-lists/:key', 'api/admin/smart-lists/:key'])
  @RequirePermission('EXPORTS', 'VIEW')
  smartList(@CurrentUser() user: MvpUser, @Param('key') key: string) {
    return this.service.smartList(user, key);
  }

  @Get(['admin/smart-lists/:key/count', 'api/admin/smart-lists/:key/count'])
  @RequirePermission('EXPORTS', 'VIEW')
  async smartListCount(@CurrentUser() user: MvpUser, @Param('key') key: string) {
    const data = await this.service.smartList(user, key);
    return { count: data.count };
  }

  @Post(['admin/smart-lists/:key/duplicate', 'api/admin/smart-lists/:key/duplicate'])
  @RequirePermission('EXPORTS', 'EXPORT')
  duplicateSmartList(@CurrentUser() user: MvpUser, @Param('key') key: string) {
    return this.service.duplicateSmartList(user, key);
  }

  @Get(['admin/module-preferences/:module', 'api/admin/module-preferences/:module'])
  @RequirePermission('EXPORTS', 'VIEW')
  preferences(@CurrentUser() user: MvpUser, @Param('module') module: SavedViewModule) {
    return this.service.preferences(user, module);
  }

  @Patch(['admin/module-preferences/:module', 'api/admin/module-preferences/:module'])
  @RequirePermission('EXPORTS', 'EXPORT')
  updatePreferences(@CurrentUser() user: MvpUser, @Param('module') module: SavedViewModule, @Body() dto: UpdateModulePreferencesDto) {
    return this.service.updatePreferences(user, module, dto);
  }
}
