import { Module } from '@nestjs/common';
import { TenantContextInterceptor } from './tenant-context.interceptor';

@Module({
  providers: [TenantContextInterceptor],
  exports: [TenantContextInterceptor],
})
export class TenantModule {}
