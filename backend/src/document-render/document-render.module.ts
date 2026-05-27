import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DocumentRenderController } from './document-render.controller';
import { DocumentRenderService } from './document-render.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [DocumentRenderController],
  providers: [DocumentRenderService],
  exports: [DocumentRenderService],
})
export class DocumentRenderModule {}
