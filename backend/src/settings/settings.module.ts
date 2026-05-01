import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { OrganizationSettingsController } from './organization-settings.controller';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [AuditModule],
  controllers: [SettingsController, OrganizationSettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
