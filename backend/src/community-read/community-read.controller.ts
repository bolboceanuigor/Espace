import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { CommunityReadService } from './community-read.service';

@Controller()
export class CommunityReadController {
  constructor(private readonly communityReadService: CommunityReadService) {}

  @Public()
  @Get(['issues', 'api/issues'])
  listIssues() {
    return this.communityReadService.listIssues();
  }

  @Public()
  @Get(['issues/:id', 'api/issues/:id'])
  getIssue(@Param('id') id: string) {
    return this.communityReadService.getIssue(id);
  }

  // Temporary MVP endpoint until the full backend guard stack is re-enabled.
  @Public()
  @Patch(['issues/:id/status', 'api/issues/:id/status'])
  updateIssueStatus(@Param('id') id: string, @Body() body: unknown) {
    return this.communityReadService.updateIssueStatus(id, body);
  }

  @Public()
  @Get(['announcements', 'api/announcements'])
  listAnnouncements() {
    return this.communityReadService.listAnnouncements();
  }

  // Temporary MVP endpoint until the full backend guard stack is re-enabled.
  @Public()
  @Post(['announcements', 'api/announcements'])
  createAnnouncement(@Body() body: unknown) {
    return this.communityReadService.createAnnouncement(body);
  }

  @Public()
  @Get(['announcements/:id', 'api/announcements/:id'])
  getAnnouncement(@Param('id') id: string) {
    return this.communityReadService.getAnnouncement(id);
  }
}
