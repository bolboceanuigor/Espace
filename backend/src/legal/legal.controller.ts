import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { LegalDocumentType, Role } from '@prisma/client';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  LegalContactNoteDto,
  LegalContactRequestDto,
  LegalContactStatusDto,
  UpdateLegalDocumentDto,
  UpsertLegalDocumentDto,
} from './dto/legal.dto';
import { LegalService } from './legal.service';

type LegalRequest = {
  user?: {
    id?: string;
    role?: string;
    organizationId?: string;
    associationId?: string;
  };
};

@Controller('api/legal')
export class PublicLegalController {
  constructor(private readonly legalService: LegalService) {}

  @Get('documents')
  @Public()
  documents(@Query() query: Record<string, string | undefined>) {
    return this.legalService.publicDocuments(query);
  }

  @Get('documents/:slug')
  @Public()
  document(@Param('slug') slug: string, @Query('locale') locale?: string) {
    return this.legalService.publicBySlug(slug, locale || 'ro');
  }

  @Get('active/:type')
  @Public()
  active(@Param('type') type: LegalDocumentType, @Query('locale') locale?: string) {
    return this.legalService.publicActive(type, locale || 'ro');
  }

  @Post('contact-requests')
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  contact(@Req() req: LegalRequest, @Body() dto: LegalContactRequestDto) {
    return this.legalService.createContactRequest(dto, req.user);
  }
}

@Controller('api/superadmin/legal')
@UseGuards(RolesGuard)
@Roles(Role.SUPERADMIN)
export class SuperadminLegalController {
  constructor(private readonly legalService: LegalService) {}

  @Get()
  overview() {
    return this.legalService.stats();
  }

  @Get('stats')
  stats() {
    return this.legalService.stats();
  }

  @Get('documents')
  documents(@Query() query: Record<string, string | undefined>) {
    return this.legalService.superadminListDocuments(query);
  }

  @Post('documents')
  create(@Req() req: LegalRequest, @Body() dto: UpsertLegalDocumentDto) {
    return this.legalService.superadminCreateDocument(dto, req.user);
  }

  @Get('documents/:id')
  get(@Param('id') id: string) {
    return this.legalService.superadminGetDocument(id);
  }

  @Patch('documents/:id')
  update(@Req() req: LegalRequest, @Param('id') id: string, @Body() dto: UpdateLegalDocumentDto) {
    return this.legalService.superadminUpdateDocument(id, dto, req.user);
  }

  @Patch('documents/:id/publish')
  publish(@Req() req: LegalRequest, @Param('id') id: string) {
    return this.legalService.publishDocument(id, req.user);
  }

  @Patch('documents/:id/archive')
  archive(@Req() req: LegalRequest, @Param('id') id: string) {
    return this.legalService.archiveDocument(id, req.user);
  }

  @Post('documents/:id/duplicate')
  duplicate(@Req() req: LegalRequest, @Param('id') id: string) {
    return this.legalService.duplicateDocument(id, req.user);
  }

  @Get('contact-requests')
  contactRequests(@Query() query: Record<string, string | undefined>) {
    return this.legalService.superadminListContactRequests(query);
  }

  @Get('contact-requests/:id')
  contactRequest(@Param('id') id: string) {
    return this.legalService.superadminGetContactRequest(id);
  }

  @Patch('contact-requests/:id/status')
  contactStatus(@Req() req: LegalRequest, @Param('id') id: string, @Body() dto: LegalContactStatusDto) {
    return this.legalService.updateContactStatus(id, dto, req.user);
  }

  @Post('contact-requests/:id/notes')
  contactNote(@Param('id') id: string, @Body() dto: LegalContactNoteDto) {
    return this.legalService.addContactNote(id, dto);
  }
}
