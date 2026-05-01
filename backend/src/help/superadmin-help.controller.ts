import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { HelpService } from './help.service';
import { UpsertHelpArticleDto } from './dto/upsert-help-article.dto';

@Controller('api/superadmin/help/articles')
@UseGuards(RolesGuard)
@Roles(Role.SUPERADMIN)
export class SuperadminHelpController {
  constructor(private readonly helpService: HelpService) {}

  @Get()
  listAll() {
    return this.helpService.superadminListAll();
  }

  @Post()
  create(@Body() dto: UpsertHelpArticleDto) {
    return this.helpService.superadminCreate(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<UpsertHelpArticleDto>) {
    return this.helpService.superadminUpdate(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.helpService.superadminDelete(id);
  }
}

