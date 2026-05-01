import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CreateReleaseNoteDto,
  ReleaseNotesFiltersDto,
  UpdateReleaseNoteDto,
} from './dto/release-notes.dto';
import { ReleaseNotesService } from './release-notes.service';

@Controller('api')
@UseGuards(JwtAuthGuard)
export class ReleaseNotesController {
  constructor(private readonly releaseNotesService: ReleaseNotesService) {}

  @Get('release-notes')
  listForUser(@CurrentUser() user: any) {
    return this.releaseNotesService.listForUser(user);
  }

  @Get('release-notes/unread')
  listUnreadForUser(@CurrentUser() user: any) {
    return this.releaseNotesService.listUnreadForUser(user);
  }

  @Patch('release-notes/:id/read')
  markRead(@CurrentUser() user: any, @Param('id') id: string) {
    return this.releaseNotesService.markRead(user, id);
  }

  @Get('superadmin/release-notes')
  superadminList(@CurrentUser() user: any, @Query() query: ReleaseNotesFiltersDto) {
    return this.releaseNotesService.superadminList(user, query);
  }

  @Post('superadmin/release-notes')
  superadminCreate(@CurrentUser() user: any, @Body() body: CreateReleaseNoteDto) {
    return this.releaseNotesService.superadminCreate(user, body);
  }

  @Patch('superadmin/release-notes/:id')
  superadminUpdate(@CurrentUser() user: any, @Param('id') id: string, @Body() body: UpdateReleaseNoteDto) {
    return this.releaseNotesService.superadminUpdate(user, id, body);
  }

  @Delete('superadmin/release-notes/:id')
  superadminDelete(@CurrentUser() user: any, @Param('id') id: string) {
    return this.releaseNotesService.superadminDelete(user, id);
  }

  @Post('superadmin/release-notes/:id/publish')
  superadminPublish(@CurrentUser() user: any, @Param('id') id: string) {
    return this.releaseNotesService.superadminPublish(user, id);
  }
}
