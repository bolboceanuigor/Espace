import { Module } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { OrganizationsController } from './organizations.controller';
import { AdminsController } from './admins.controller';
import { AssociationOnboardingController } from './association-onboarding.controller';
import { AssociationOnboardingService } from './association-onboarding.service';
import { OrganizationOnboardingWorkspaceController } from './organization-onboarding-workspace.controller';
import { OrganizationOnboardingWorkspaceService } from './organization-onboarding-workspace.service';
import { OrganizationContractController } from './organization-contract.controller';
import { OrganizationContractService } from './organization-contract.service';
import { SuperadminBillingTasksController } from './superadmin-billing-tasks.controller';
import { SuperadminBillingTasksService } from './superadmin-billing-tasks.service';
import { SuperadminOrganizationDetailController } from './superadmin-organization-detail.controller';
import { SuperadminRevenueController } from './superadmin-revenue.controller';
import { SuperadminRevenueService } from './superadmin-revenue.service';
import { MvpSecurityModule } from '../security/mvp-security.module';
import { ActivityMvpModule } from '../activity-mvp/activity-mvp.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [MvpSecurityModule, ActivityMvpModule, AuditModule],
  controllers: [
    OrganizationsController,
    AdminsController,
    AssociationOnboardingController,
    OrganizationOnboardingWorkspaceController,
    OrganizationContractController,
    SuperadminBillingTasksController,
    SuperadminOrganizationDetailController,
    SuperadminRevenueController,
  ],
  providers: [
    OrganizationsService,
    AssociationOnboardingService,
    OrganizationOnboardingWorkspaceService,
    OrganizationContractService,
    SuperadminBillingTasksService,
    SuperadminRevenueService,
  ],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
