import { Module } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { OrganizationsController } from './organizations.controller';
import { AdminsController } from './admins.controller';
import { MvpSecurityModule } from '../security/mvp-security.module';

@Module({
  imports: [MvpSecurityModule],
  controllers: [OrganizationsController, AdminsController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
