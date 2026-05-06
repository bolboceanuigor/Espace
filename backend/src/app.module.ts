import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { ApartmentsModule } from './apartments/apartments.module';
import { ResidentsModule } from './residents/residents.module';
import { MetersModule } from './meters/meters.module';
import { BillingReadModule } from './billing-read/billing-read.module';
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
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
