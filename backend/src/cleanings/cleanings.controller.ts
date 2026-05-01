import { Controller, Get, Patch, Param, Query, Body, Req } from '@nestjs/common';
import { CleaningsService } from './cleanings.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { getOrgId } from '../common/org-scope';
import type { Request } from 'express';
import { UpdateCleaningDto } from './dto/update-cleaning.dto';

@Controller(['cleanings', 'api/cleanings'])
export class CleaningsController {
  constructor(private readonly cleaningsService: CleaningsService) {}

  @Get()
  list(
    @CurrentUser() user: any,
    @Query('start') start: string | undefined,
    @Query('end') end: string | undefined,
    @Query('status') status: string | undefined,
    @Req() req: Request,
  ) {
    const organizationId = getOrgId(user, req);
    return this.cleaningsService.list({
      organizationId,
      userId: user.sub ?? user.id,
      role: user.role,
      start,
      end,
      status,
    });
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() payload: UpdateCleaningDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const organizationId = getOrgId(user, req);
    return this.cleaningsService.update(id, {
      organizationId,
      userId: user.sub ?? user.id,
      role: user.role,
      payload,
    });
  }
}
