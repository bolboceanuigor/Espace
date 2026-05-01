import { Body, Controller, Get, Param, ParseFilePipe, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AllowsPastDue, RequiresActiveSubscription } from '../subscription/subscription-access.decorator';
import { SubscriptionAccessGuard } from '../subscription/subscription-access.guard';
import { UploadImportDto } from './dto/imports.dto';
import { ImportsService } from './imports.service';

@Controller('api')
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Post('admin/imports/upload')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  @UseInterceptors(FileInterceptor('file'))
  adminUpload(
    @CurrentUser() user: any,
    @Body() body: UploadImportDto,
    @UploadedFile(new ParseFilePipe({ fileIsRequired: true })) file: Express.Multer.File,
  ) {
    return this.importsService.uploadAdmin(user, body.type, file.originalname, file.buffer);
  }

  @Get('admin/imports/:id/preview')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsPastDue()
  adminPreview(@CurrentUser() user: any, @Param('id') id: string) {
    return this.importsService.previewAdmin(user, id);
  }

  @Post('admin/imports/:id/confirm')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  adminConfirm(@CurrentUser() user: any, @Param('id') id: string) {
    return this.importsService.confirmAdmin(user, id);
  }

  @Get('admin/imports')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsPastDue()
  adminList(@CurrentUser() user: any) {
    return this.importsService.listAdmin(user);
  }

  @Get('admin/imports/templates/:type')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsPastDue()
  adminTemplate(@Param('type') type: any, @Res() res: Response) {
    const buffer = this.importsService.templateXlsx(type);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${String(type).toLowerCase()}-template.xlsx"`);
    res.send(buffer);
  }

  @Post('superadmin/organizations/:id/imports/upload')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN, Role.SUPER_ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  superadminUpload(
    @CurrentUser() user: any,
    @Param('id') organizationId: string,
    @Body() body: UploadImportDto,
    @UploadedFile(new ParseFilePipe({ fileIsRequired: true })) file: Express.Multer.File,
  ) {
    return this.importsService.uploadSuperadmin(user, organizationId, body.type, file.originalname, file.buffer);
  }

  @Get('superadmin/imports/:id/preview')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN, Role.SUPER_ADMIN)
  superadminPreview(@CurrentUser() user: any, @Param('id') id: string) {
    return this.importsService.previewSuperadmin(user, id);
  }

  @Post('superadmin/imports/:id/confirm')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN, Role.SUPER_ADMIN)
  superadminConfirm(@CurrentUser() user: any, @Param('id') id: string) {
    return this.importsService.confirmSuperadmin(user, id);
  }
}
