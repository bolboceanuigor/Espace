import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthService } from '../auth/auth.service';
import { UpdatePreferencesDto } from '../auth/dto/update-preferences.dto';
import { NavigationService } from './navigation.service';

@Controller('api')
export class MeController {
  constructor(
    private readonly authService: AuthService,
    private readonly navigationService: NavigationService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@CurrentUser() user: any) {
    return this.authService.getMePayload(user.id ?? user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/preferences')
  async updatePreferences(@CurrentUser() user: any, @Body() dto: UpdatePreferencesDto) {
    return this.authService.updateMyPreferences(user.id ?? user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/navigation')
  async getNavigation(@CurrentUser() user: any) {
    return this.navigationService.getNavigationForUser(user);
  }
}

