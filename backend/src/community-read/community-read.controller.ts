import { Controller, Get, Param } from '@nestjs/common';
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

  @Public()
  @Get(['announcements', 'api/announcements'])
  listAnnouncements() {
    return this.communityReadService.listAnnouncements();
  }

  @Public()
  @Get(['announcements/:id', 'api/announcements/:id'])
  getAnnouncement(@Param('id') id: string) {
    return this.communityReadService.getAnnouncement(id);
  }
}
