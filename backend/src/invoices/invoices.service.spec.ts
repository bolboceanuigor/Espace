import { NotFoundException } from '@nestjs/common';
import { InvoicesService } from './invoices.service';

describe('InvoicesService tenant isolation', () => {
  function createService() {
    const prisma = {
      residentProfile: { findMany: jest.fn() },
      residentInvoice: { findFirst: jest.fn() },
    };
    const auditService = {
      logAction: jest.fn().mockResolvedValue(undefined),
      logUpdate: jest.fn().mockResolvedValue(undefined),
    };
    const notificationsService = {
      notifyUsers: jest.fn().mockResolvedValue(undefined),
      createNotification: jest.fn().mockResolvedValue(undefined),
    };
    const emailTemplateService = {
      sendTemplateEmail: jest.fn().mockResolvedValue(undefined),
    };
    const saasLimits = {
      assertCanFinalizeInvoices: jest.fn().mockResolvedValue(undefined),
    };
    const service = new InvoicesService(
      prisma as any,
      auditService as any,
      notificationsService as any,
      emailTemplateService as any,
      saasLimits as any,
    );
    return { service, prisma };
  }

  it('does not return another tenant invoice to a resident', async () => {
    const { service, prisma } = createService();
    prisma.residentProfile.findMany.mockResolvedValue([{ apartmentId: 'apt-a' }]);
    prisma.residentInvoice.findFirst.mockResolvedValue(null);

    await expect(
      service.residentGetOne({ id: 'resident-a', role: 'RESIDENT', organizationId: 'org-a' } as any, 'invoice-b'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.residentInvoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'invoice-b',
          organizationId: 'org-a',
          apartmentId: { in: ['apt-a'] },
        },
      }),
    );
  });
});
