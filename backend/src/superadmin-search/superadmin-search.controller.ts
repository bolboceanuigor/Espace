import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SuperAdminGuard } from '../auth/guards/superadmin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SaveSuperadminSearchHistoryDto } from './dto/superadmin-search.dto';
import { SuperadminSearchService } from './superadmin-search.service';

@Controller('api/superadmin')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class SuperadminSearchController {
  constructor(private readonly service: SuperadminSearchService) {}

  @Get('search')
  search(@CurrentUser() user: any, @Query() query: Record<string, string | undefined>) {
    return this.service.searchAll(user, query);
  }

  @Get('search/recent')
  recent(@CurrentUser() user: any) {
    return this.service.recent(user);
  }

  @Post('search/recent')
  saveRecent(@CurrentUser() user: any, @Body() dto: SaveSuperadminSearchHistoryDto) {
    return this.service.saveRecent(user, dto);
  }

  @Delete('search/recent')
  clearRecent(@CurrentUser() user: any) {
    return this.service.clearRecent(user);
  }

  @Get('commands')
  commands(@CurrentUser() user: any) {
    return this.service.commands(user);
  }

  @Post('commands/:commandKey/execute')
  execute(@CurrentUser() user: any, @Param('commandKey') commandKey: string) {
    return this.service.executeCommand(user, commandKey);
  }

  @Get('client-navigator/:associationId')
  clientNavigator(@CurrentUser() user: any, @Param('associationId') associationId: string) {
    return this.service.clientNavigator(user, associationId);
  }
}
