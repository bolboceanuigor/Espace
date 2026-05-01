import { Body, Controller, Delete, Get, Param, ParseFilePipe, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AllowsPastDue, RequiresActiveSubscription } from '../subscription/subscription-access.decorator';
import { SubscriptionAccessGuard } from '../subscription/subscription-access.guard';
import {
  ApplyMappingDto,
  BatchMatchesQueryDto,
  CreateMappingTemplateDto,
  UpdateMappingTemplateDto,
  UploadReconciliationDto,
} from './dto/reconciliation.dto';
import { ReconciliationService } from './reconciliation.service';

@Controller('api/admin/reconciliation')
@UseGuards(RolesGuard, SubscriptionAccessGuard)
@Roles(Role.ADMIN)
export class ReconciliationController {
  constructor(private readonly service: ReconciliationService) {}

  @Post('upload')
  @RequiresActiveSubscription()
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @CurrentUser() user: any,
    @Body() body: UploadReconciliationDto,
    @UploadedFile(new ParseFilePipe({ fileIsRequired: true })) file: Express.Multer.File,
  ) {
    return this.service.upload(user, body.source, file.originalname, file.buffer);
  }

  @Get('batches')
  @AllowsPastDue()
  listBatches(@CurrentUser() user: any, @Query() query: BatchMatchesQueryDto) {
    return this.service.listBatches(user, query);
  }

  @Get('mapping-templates')
  @AllowsPastDue()
  listTemplates(@CurrentUser() user: any, @Query('source') source?: any) {
    return this.service.listMappingTemplates(user, source);
  }

  @Post('mapping-templates')
  @RequiresActiveSubscription()
  createTemplate(@CurrentUser() user: any, @Body() dto: CreateMappingTemplateDto) {
    return this.service.createMappingTemplate(user, dto);
  }

  @Patch('mapping-templates/:id')
  @RequiresActiveSubscription()
  updateTemplate(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateMappingTemplateDto) {
    return this.service.updateMappingTemplate(user, id, dto);
  }

  @Delete('mapping-templates/:id')
  @RequiresActiveSubscription()
  deleteTemplate(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.deleteMappingTemplate(user, id);
  }

  @Get('batches/:id')
  @AllowsPastDue()
  getBatch(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.getBatch(user, id);
  }

  @Get('batches/:id/headers')
  @AllowsPastDue()
  getBatchHeaders(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.getBatchHeaders(user, id);
  }

  @Post('batches/:id/apply-mapping')
  @RequiresActiveSubscription()
  applyBatchMapping(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: ApplyMappingDto) {
    return this.service.applyBatchMapping(user, id, dto);
  }

  @Post('batches/:id/run')
  @RequiresActiveSubscription()
  runBatch(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.runBatch(user, id);
  }

  @Get('batches/:id/matches')
  @AllowsPastDue()
  listMatches(@CurrentUser() user: any, @Param('id') id: string, @Query() query: BatchMatchesQueryDto) {
    return this.service.listBatchMatches(user, id, query);
  }

  @Patch('matches/:id/confirm')
  @RequiresActiveSubscription()
  confirmMatch(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.confirmMatch(user, id);
  }

  @Patch('matches/:id/reject')
  @RequiresActiveSubscription()
  rejectMatch(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.rejectMatch(user, id);
  }

  @Patch('imported-payments/:id/ignore')
  @RequiresActiveSubscription()
  ignoreImportedPayment(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.ignoreImportedPayment(user, id);
  }
}

