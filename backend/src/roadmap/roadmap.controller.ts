import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RoadmapService } from './roadmap.service';
import { CreateRoadmapFeatureDto, RoadmapFeatureFiltersDto, UpdateRoadmapFeatureDto } from './dto/roadmap.dto';

@Controller('api')
@UseGuards(JwtAuthGuard)
export class RoadmapController {
  constructor(private readonly roadmapService: RoadmapService) {}

  @Get('roadmap/features')
  listFeatures(@CurrentUser() user: any, @Query() query: RoadmapFeatureFiltersDto) {
    return this.roadmapService.listFeaturesForUser(user, query);
  }

  @Post('roadmap/features')
  createFeature(@CurrentUser() user: any, @Body() body: CreateRoadmapFeatureDto) {
    return this.roadmapService.createFeature(user, body);
  }

  @Post('roadmap/features/:id/vote')
  voteFeature(@CurrentUser() user: any, @Param('id') id: string) {
    return this.roadmapService.voteFeature(user, id);
  }

  @Delete('roadmap/features/:id/vote')
  unvoteFeature(@CurrentUser() user: any, @Param('id') id: string) {
    return this.roadmapService.unvoteFeature(user, id);
  }

  @Get('superadmin/roadmap/features')
  listFeaturesForSuperadmin(@CurrentUser() user: any, @Query() query: RoadmapFeatureFiltersDto) {
    return this.roadmapService.listFeaturesForSuperadmin(user, query);
  }

  @Patch('superadmin/roadmap/features/:id')
  updateFeature(@CurrentUser() user: any, @Param('id') id: string, @Body() body: UpdateRoadmapFeatureDto) {
    return this.roadmapService.updateFeatureBySuperadmin(user, id, body);
  }
}
