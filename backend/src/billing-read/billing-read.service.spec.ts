import { NotFoundException } from '@nestjs/common';
import { InvoiceStatus, Role } from '@prisma/client';
import { BillingReadService } from './billing-read.service';

describe('BillingReadService', () => {
  function createService() {
    const prisma = {
      organization: { findUnique: jest.fn() },
      apartment: { findFirst: jest.fn() },
      invoice: { findFirst: jest.fn(), create: jest.fn() },
    };
    const activity = {
      createActivity: jest.fn().mockResolvedValue(undefined),
      notifyApartmentResidents: jest.fn().mockResolvedValue(undefined),
    };
    const audit = {
      logAction: jest.fn().mockResolvedValue(undefined),
    };
    const service = new BillingReadService(prisma as any, activity as any, audit as any);
    jest.spyOn(service as any, 'toInvoice').mockImplementation((row: unknown) => row);
    return { service, prisma, activity, audit };
  }

  it('creates a simple invoice inside the admin organization and notifies residents', async () => {
    const { service, prisma, activity } = createService();
    prisma.organization.findUnique.mockResolvedValue({ id: 'org-1' });
    prisma.apartment.findFirst.mockResolvedValue({ id: 'apt-1' });
    prisma.invoice.findFirst.mockResolvedValue(null);
    prisma.invoice.create.mockResolvedValue({
      id: 'inv-1',
      organizationId: 'org-1',
      apartmentId: 'apt-1',
      month: 6,
      year: 2026,
      amount: 500,
      finalAmount: 500,
      status: InvoiceStatus.UNPAID,
      dueDate: new Date('2026-06-25T00:00:00.000Z'),
    });

    const result = await service.createInvoice(
      { id: 'admin-1', role: Role.ADMIN, organizationId: 'org-1' } as any,
      {
        organizationId: 'org-2',
        apartmentId: 'apt-1',
        month: 6,
        year: 2026,
        amount: 500,
        dueDate: '2026-06-25',
      },
    );

    expect(prisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-1',
          apartmentId: 'apt-1',
          amount: 500,
        }),
      }),
    );
    expect(activity.notifyApartmentResidents).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        apartmentId: 'apt-1',
      }),
    );
    expect(result).toEqual(expect.objectContaining({ id: 'inv-1' }));
  });

  it('rejects simple invoice creation for an apartment outside the admin organization', async () => {
    const { service, prisma } = createService();
    prisma.organization.findUnique.mockResolvedValue({ id: 'org-1' });
    prisma.apartment.findFirst.mockResolvedValue(null);

    await expect(
      service.createInvoice(
        { id: 'admin-1', role: Role.ADMIN, organizationId: 'org-1' } as any,
        {
          apartmentId: 'apt-foreign',
          month: 6,
          year: 2026,
          amount: 500,
          dueDate: '2026-06-25',
        },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
