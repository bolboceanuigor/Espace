import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/guards/superadmin.guard';
import { CreateEmailTemplateDto, UpdateEmailTemplateDto } from './dto/email-template.dto';
import { EmailTemplateService } from './email-template.service';

@Controller('api/superadmin/email-templates')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class EmailTemplatesController {
  constructor(private readonly emailTemplateService: EmailTemplateService) {}

  @Get()
  list() {
    return this.emailTemplateService.listAll();
  }

  @Post()
  create(@Body() body: CreateEmailTemplateDto) {
    return this.emailTemplateService.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateEmailTemplateDto) {
    return this.emailTemplateService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.emailTemplateService.remove(id);
  }
}
