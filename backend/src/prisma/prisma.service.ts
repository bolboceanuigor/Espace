import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
    this.$use(async (params, next) => {
      const result = await next(params);
      if (params.model === 'Payment' && params.action === 'create' && result?.id && result?.status === 'CONFIRMED') {
        const payment = result as {
          id: string;
          organizationId: string;
          apartmentId: string;
          amount: number;
          createdAt: Date;
        };
        const existing = await this.receipt.findUnique({ where: { paymentId: payment.id }, select: { id: true } });
        if (!existing) {
          const organization = await this.organization.findUnique({
            where: { id: payment.organizationId },
            select: { receiptPrefix: true },
          });
          const prefix = (organization?.receiptPrefix || 'RCPT').trim().toUpperCase();
          const timestamp = new Date(payment.createdAt || new Date()).toISOString().slice(0, 10).replace(/-/g, '');
          await this.receipt.create({
            data: {
              organizationId: payment.organizationId,
              apartmentId: payment.apartmentId,
              paymentId: payment.id,
              receiptNumber: `${prefix}-${timestamp}-${payment.id.slice(0, 8).toUpperCase()}`,
              amount: Number(payment.amount || 0),
              paymentDate: payment.createdAt || new Date(),
            },
          });
        }
      }
      return result;
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
