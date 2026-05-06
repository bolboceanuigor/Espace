import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { ApartmentsModule } from './apartments/apartments.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    OrganizationsModule,
    ApartmentsModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
