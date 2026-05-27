import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { HelpAudience } from '@prisma/client';
import { HelpService } from './help.service';
import { HelpFeedbackDto, OnboardingProgressDto } from './dto/upsert-help-article.dto';

type HelpRequest = {
  user?: {
    id?: string;
    role?: string;
    organizationId?: string;
    associationId?: string;
  };
};

@Controller('api')
export class HelpController {
  constructor(private readonly helpService: HelpService) {}

  @Get('help')
  getHelpHome(@Req() req: HelpRequest) {
    return this.helpService.getHelpHome(req.user);
  }

  @Get('help/categories')
  getCategories(@Req() req: HelpRequest) {
    return this.helpService.listCategoriesForAudiences([HelpAudience.PUBLIC, ...(req.user?.role ? [] : [])]);
  }

  @Get('help/articles')
  listArticles(@Req() req: HelpRequest, @Query() query: Record<string, string | undefined>) {
    return this.helpService.listArticles(req.user, query);
  }

  @Get('help/articles/:slug')
  getBySlug(@Req() req: HelpRequest, @Param('slug') slug: string) {
    return this.helpService.getArticleBySlug(req.user, slug);
  }

  @Post('help/articles/:id/feedback')
  submitFeedback(@Req() req: HelpRequest, @Param('id') id: string, @Body() dto: HelpFeedbackDto) {
    return this.helpService.submitFeedback(req.user, id, dto);
  }

  @Get('admin/help')
  adminHelp(@Req() req: HelpRequest) {
    return this.helpService.getHelpHome(req.user, HelpAudience.ADMIN);
  }

  @Get('admin/help/contextual')
  adminContextualHelp(@Req() req: HelpRequest, @Query('route') route?: string, @Query('module') module?: string) {
    return this.helpService.contextualHelp(req.user, { route, module }, HelpAudience.ADMIN);
  }

  @Get('admin/onboarding-guide')
  adminOnboardingGuide(@Req() req: HelpRequest) {
    return this.helpService.adminOnboardingGuide(req.user);
  }

  @Patch('admin/onboarding-guide/progress')
  updateAdminOnboardingProgress(@Req() req: HelpRequest, @Body() dto: OnboardingProgressDto) {
    return this.helpService.updateAdminOnboardingProgress(req.user, dto);
  }

  @Get('resident/help')
  residentHelp(@Req() req: HelpRequest) {
    return this.helpService.getHelpHome(req.user, HelpAudience.RESIDENT);
  }

  @Get('resident/help/contextual')
  residentContextualHelp(@Req() req: HelpRequest, @Query('route') route?: string, @Query('module') module?: string) {
    return this.helpService.contextualHelp(req.user, { route, module }, HelpAudience.RESIDENT);
  }
}
