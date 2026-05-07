import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { ApartmentsModule } from './apartments/apartments.module';
import { ResidentsModule } from './residents/residents.module';
import { MetersModule } from './meters/meters.module';
import { BillingReadModule } from './billing-read/billing-read.module';
import { CommunityReadModule } from './community-read/community-read.module';
import { ResidentDemoModule } from './resident-demo/resident-demo.module';
import { DemoAuthReadModule } from './demo-auth-read/demo-auth-read.module';
import { MinimalAuthModule } from './minimal-auth/minimal-auth.module';
import { SaasManagementModule } from './saas-management/saas-management.module';
import { SetupModule } from './setup/setup.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    OrganizationsModule,
    ApartmentsModule,
    ResidentsModule,
    MetersModule,
    BillingReadModule,
    CommunityReadModule,
    ResidentDemoModule,
    DemoAuthReadModule,
    MinimalAuthModule,
    SaasManagementModule,
    SetupModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
