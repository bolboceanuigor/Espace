import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { SubscriptionAccessGuard } from '../subscription/subscription-access.guard';
import { HelpService } from './help.service';

@Controller('api')
@UseGuards(RolesGuard, SubscriptionAccessGuard)
export class HelpController {
  constructor(private readonly helpService: HelpService) {}

  @Get('help/articles')
  listArticles(
    @Req() req: { user?: { role?: string } },
    @Query('category') category?: string,
    @Query('search') search?: string,
  ) {
    return this.helpService.listForUser(req.user?.role || '', { category, search });
  }

  @Get('help/articles/:slug')
  getBySlug(@Req() req: { user?: { role?: string } }, @Param('slug') slug: string) {
    return this.helpService.getBySlugForUser(req.user?.role || '', slug);
  }
}

