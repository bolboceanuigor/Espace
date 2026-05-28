import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CreateProductReleaseDto,
  CreateProductUpdateDto,
  CreateReleaseNoteDto,
  ProductReleaseFiltersDto,
  ProductUpdateFiltersDto,
  ReleaseNotesFiltersDto,
  UpdateProductReleaseDto,
  UpdateProductUpdateDto,
  UpdateReleaseNoteDto,
} from './dto/release-notes.dto';
import { ReleaseNotesService } from './release-notes.service';

@Controller('api')
@UseGuards(JwtAuthGuard)
export class ReleaseNotesController {
  constructor(private readonly releaseNotesService: ReleaseNotesService) {}

  @Public()
  @Get('changelog')
  publicChangelog() {
    return this.releaseNotesService.publicChangelog();
  }

  @Public()
  @Get('product-updates/public-changelog')
  productUpdatesPublicChangelog() {
    return this.releaseNotesService.publicChangelog();
  }

  @Get('product-updates')
  listProductUpdates(@CurrentUser() user: any, @Query() query: ProductUpdateFiltersDto) {
    return this.releaseNotesService.listProductUpdatesForUser(user, query);
  }

  @Get('product-updates/unread')
  listUnreadProductUpdates(@CurrentUser() user: any) {
    return this.releaseNotesService.listUnreadProductUpdatesForUser(user);
  }

  @Patch('product-updates/:id/acknowledge')
  acknowledgeProductUpdate(@CurrentUser() user: any, @Param('id') id: string) {
    return this.releaseNotesService.acknowledgeProductUpdate(user, id);
  }

  @Get('release-notes')
  listForUser(@CurrentUser() user: any) {
    return this.releaseNotesService.listForUser(user);
  }

  @Get('release-notes/unread')
  listUnreadForUser(@CurrentUser() user: any) {
    return this.releaseNotesService.listUnreadForUser(user);
  }

  @Patch('release-notes/:id/read')
  markRead(@CurrentUser() user: any, @Param('id') id: string) {
    return this.releaseNotesService.markRead(user, id);
  }

  @Get('superadmin/release-notes')
  superadminList(@CurrentUser() user: any, @Query() query: ReleaseNotesFiltersDto) {
    return this.releaseNotesService.superadminList(user, query);
  }

  @Post('superadmin/release-notes')
  superadminCreate(@CurrentUser() user: any, @Body() body: CreateReleaseNoteDto) {
    return this.releaseNotesService.superadminCreate(user, body);
  }

  @Patch('superadmin/release-notes/:id')
  superadminUpdate(@CurrentUser() user: any, @Param('id') id: string, @Body() body: UpdateReleaseNoteDto) {
    return this.releaseNotesService.superadminUpdate(user, id, body);
  }

  @Delete('superadmin/release-notes/:id')
  superadminDelete(@CurrentUser() user: any, @Param('id') id: string) {
    return this.releaseNotesService.superadminDelete(user, id);
  }

  @Post('superadmin/release-notes/:id/publish')
  superadminPublish(@CurrentUser() user: any, @Param('id') id: string) {
    return this.releaseNotesService.superadminPublish(user, id);
  }

  @Get('superadmin/product-updates/dashboard')
  superadminProductUpdatesDashboard(@CurrentUser() user: any) {
    return this.releaseNotesService.superadminDashboard(user);
  }

  @Get('superadmin/product-releases')
  superadminListReleases(@CurrentUser() user: any, @Query() query: ProductReleaseFiltersDto) {
    return this.releaseNotesService.superadminListReleases(user, query);
  }

  @Post('superadmin/product-releases')
  superadminCreateRelease(@CurrentUser() user: any, @Body() body: CreateProductReleaseDto) {
    return this.releaseNotesService.superadminCreateRelease(user, body);
  }

  @Get('superadmin/product-releases/:id')
  superadminGetRelease(@CurrentUser() user: any, @Param('id') id: string) {
    return this.releaseNotesService.superadminGetRelease(user, id);
  }

  @Patch('superadmin/product-releases/:id')
  superadminUpdateRelease(@CurrentUser() user: any, @Param('id') id: string, @Body() body: UpdateProductReleaseDto) {
    return this.releaseNotesService.superadminUpdateRelease(user, id, body);
  }

  @Delete('superadmin/product-releases/:id')
  superadminDeleteRelease(@CurrentUser() user: any, @Param('id') id: string) {
    return this.releaseNotesService.superadminDeleteRelease(user, id);
  }

  @Post('superadmin/product-releases/:id/publish')
  superadminPublishRelease(@CurrentUser() user: any, @Param('id') id: string) {
    return this.releaseNotesService.superadminPublishRelease(user, id);
  }

  @Post('superadmin/product-releases/:id/archive')
  superadminArchiveRelease(@CurrentUser() user: any, @Param('id') id: string) {
    return this.releaseNotesService.superadminArchiveRelease(user, id);
  }

  @Get('superadmin/product-updates')
  superadminListProductUpdates(@CurrentUser() user: any, @Query() query: ProductUpdateFiltersDto) {
    return this.releaseNotesService.superadminListUpdates(user, query);
  }

  @Post('superadmin/product-updates')
  superadminCreateProductUpdate(@CurrentUser() user: any, @Body() body: CreateProductUpdateDto) {
    return this.releaseNotesService.superadminCreateUpdate(user, body);
  }

  @Get('superadmin/product-updates/:id/acknowledgements')
  superadminProductUpdateAcknowledgements(@CurrentUser() user: any, @Param('id') id: string) {
    return this.releaseNotesService.superadminUpdateAcknowledgements(user, id);
  }

  @Get('superadmin/product-updates/:id')
  superadminGetProductUpdate(@CurrentUser() user: any, @Param('id') id: string) {
    return this.releaseNotesService.superadminGetUpdate(user, id);
  }

  @Patch('superadmin/product-updates/:id')
  superadminUpdateProductUpdate(@CurrentUser() user: any, @Param('id') id: string, @Body() body: UpdateProductUpdateDto) {
    return this.releaseNotesService.superadminUpdateProductUpdate(user, id, body);
  }

  @Delete('superadmin/product-updates/:id')
  superadminDeleteProductUpdate(@CurrentUser() user: any, @Param('id') id: string) {
    return this.releaseNotesService.superadminDeleteUpdate(user, id);
  }

  @Post('superadmin/product-updates/:id/publish')
  superadminPublishProductUpdate(@CurrentUser() user: any, @Param('id') id: string) {
    return this.releaseNotesService.superadminPublishUpdate(user, id);
  }

  @Post('superadmin/product-updates/:id/archive')
  superadminArchiveProductUpdate(@CurrentUser() user: any, @Param('id') id: string) {
    return this.releaseNotesService.superadminArchiveUpdate(user, id);
  }
}
