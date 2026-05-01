import { Body, Controller, Delete, Get, Param, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { AllowsPastDue, RequiresActiveSubscription } from '../subscription/subscription-access.decorator';
import { SubscriptionAccessGuard } from '../subscription/subscription-access.guard';
import { UploadFileDto } from './dto/upload-file.dto';
import { FilesService } from './files.service';

@Controller('api')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('admin/files/upload')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  @UseInterceptors(FileInterceptor('file'))
  adminUpload(@CurrentUser() user: any, @Body() body: UploadFileDto, @UploadedFile() file?: Express.Multer.File) {
    return this.filesService.adminUpload(user, body, file);
  }

  @Get('admin/files')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsPastDue()
  adminList(@CurrentUser() user: any) {
    return this.filesService.adminList(user);
  }

  @Delete('admin/files/:id')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  adminDelete(@CurrentUser() user: any, @Param('id') id: string) {
    return this.filesService.adminDelete(user, id);
  }

  @Post('resident/files/upload')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT, Role.TENANT)
  @AllowsPastDue()
  @UseInterceptors(FileInterceptor('file'))
  residentUpload(@CurrentUser() user: any, @Body() body: UploadFileDto, @UploadedFile() file?: Express.Multer.File) {
    return this.filesService.residentUpload(user, body, file);
  }

  @Get('superadmin/storage')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN, Role.SUPER_ADMIN)
  superadminStorage() {
    return this.filesService.superadminStorage();
  }

  @Get('superadmin/organizations/:id/storage')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN, Role.SUPER_ADMIN)
  superadminOrgStorage(@Param('id') id: string) {
    return this.filesService.superadminOrgStorage(id);
  }

}

@Controller()
export class FileDownloadController {
  constructor(private readonly filesService: FilesService) {}

  @Get('files/:id/download')
  @UseGuards(JwtAuthGuard)
  async secureDownload(@CurrentUser() user: any, @Param('id') id: string, @Res() res: Response) {
    const file = await this.filesService.getDownloadableFile(user, id);
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.download(file.absolutePath, file.fileName);
  }
}

