import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { HelpArticleStatus, Role } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { HelpService } from './help.service';
import { UpsertHelpArticleDto, UpsertHelpCategoryDto } from './dto/upsert-help-article.dto';

type HelpRequest = {
  user?: {
    id?: string;
    role?: string;
    organizationId?: string;
    associationId?: string;
  };
};

@Controller('api/superadmin/help')
@UseGuards(RolesGuard)
@Roles(Role.SUPERADMIN)
export class SuperadminHelpController {
  constructor(private readonly helpService: HelpService) {}

  @Get('articles')
  listAll(@Query() query: Record<string, string | undefined>) {
    return this.helpService.superadminListAll(query);
  }

  @Post('articles')
  create(@Req() req: HelpRequest, @Body() dto: UpsertHelpArticleDto) {
    return this.helpService.superadminCreate(dto, req.user);
  }

  @Get('articles/:id')
  getById(@Param('id') id: string) {
    return this.helpService.superadminGetArticle(id);
  }

  @Patch('articles/:id')
  update(@Req() req: HelpRequest, @Param('id') id: string, @Body() dto: Partial<UpsertHelpArticleDto>) {
    return this.helpService.superadminUpdate(id, dto, req.user);
  }

  @Patch('articles/:id/status')
  updateStatus(@Req() req: HelpRequest, @Param('id') id: string, @Body('status') status: HelpArticleStatus) {
    return this.helpService.superadminChangeStatus(id, status, req.user);
  }

  @Post('articles/:id/duplicate')
  duplicate(@Req() req: HelpRequest, @Param('id') id: string) {
    return this.helpService.superadminDuplicate(id, req.user);
  }

  @Delete('articles/:id')
  archive(@Req() req: HelpRequest, @Param('id') id: string) {
    return this.helpService.superadminArchive(id, req.user);
  }

  @Get('categories')
  categories() {
    return this.helpService.superadminListCategories();
  }

  @Post('categories')
  createCategory(@Req() req: HelpRequest, @Body() dto: UpsertHelpCategoryDto) {
    return this.helpService.superadminUpsertCategory(dto, req.user);
  }

  @Patch('categories/:id')
  updateCategory(@Req() req: HelpRequest, @Param('id') id: string, @Body() dto: UpsertHelpCategoryDto) {
    return this.helpService.superadminUpsertCategory(dto, req.user, id);
  }

  @Get('feedback')
  feedback() {
    return this.helpService.superadminFeedback();
  }

  @Get('stats')
  stats() {
    return this.helpService.superadminStats();
  }
}
