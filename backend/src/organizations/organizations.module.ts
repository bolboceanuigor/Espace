import { Module } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { OrganizationsController } from './organizations.controller';
import { AdminsController } from './admins.controller';
import { AssociationOnboardingController } from './association-onboarding.controller';
import { AssociationOnboardingService } from './association-onboarding.service';
import { MvpSecurityModule } from '../security/mvp-security.module';
import { ActivityMvpModule } from '../activity-mvp/activity-mvp.module';

@Module({
  imports: [MvpSecurityModule, ActivityMvpModule],
  controllers: [OrganizationsController, AdminsController, AssociationOnboardingController],
  providers: [OrganizationsService, AssociationOnboardingService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
