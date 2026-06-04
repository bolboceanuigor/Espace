import { Body, Controller, Delete, Get, Param, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PermissionGuard } from '../auth/permission.guard';
import { MvpAuthGuard, MvpRolesGuard, type MvpUser } from '../security/mvp-auth.guard';
import { AllowsPastDue, RequiresActiveSubscription } from '../subscription/subscription-access.decorator';
import { SubscriptionAccessGuard } from '../subscription/subscription-access.guard';
import { UploadFileDto } from './dto/upload-file.dto';
import { FilesService } from './files.service';

@Controller('api')
@UseGuards(MvpAuthGuard, MvpRolesGuard, PermissionGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('admin/files/upload')
  @UseGuards(SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  @UseInterceptors(FileInterceptor('file'))
  adminUpload(@CurrentUser() user: MvpUser, @Body() body: UploadFileDto, @UploadedFile() file?: Express.Multer.File) {
    return this.filesService.adminUpload(user, body, file);
  }

  @Get('admin/files')
  @UseGuards(SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsPastDue()
  adminList(@CurrentUser() user: MvpUser) {
    return this.filesService.adminList(user);
  }

  @Delete('admin/files/:id')
  @UseGuards(SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  adminDelete(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.filesService.adminDelete(user, id);
  }

  @Post('resident/files/upload')
  @Roles(Role.RESIDENT)
  @AllowsPastDue()
  @UseInterceptors(FileInterceptor('file'))
  residentUpload(@CurrentUser() user: MvpUser, @Body() body: UploadFileDto, @UploadedFile() file?: Express.Multer.File) {
    return this.filesService.residentUpload(user, body, file);
  }

  @Get('superadmin/storage')
  @Roles(Role.SUPERADMIN)
  superadminStorage() {
    return this.filesService.superadminStorage();
  }

  @Get('superadmin/organizations/:id/storage')
  @Roles(Role.SUPERADMIN)
  superadminOrgStorage(@Param('id') id: string) {
    return this.filesService.superadminOrgStorage(id);
  }

}

@Controller()
export class FileDownloadController {
  constructor(private readonly filesService: FilesService) {}

  @Get('files/:id/download')
  @UseGuards(MvpAuthGuard)
  async secureDownload(@CurrentUser() user: MvpUser, @Param('id') id: string, @Res() res: Response) {
    const file = await this.filesService.getDownloadableFile(user, id);
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.download(file.absolutePath, file.fileName);
  }
}
