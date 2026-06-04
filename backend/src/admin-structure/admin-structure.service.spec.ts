import { NotFoundException } from '@nestjs/common';
import { AdminStructureService } from './admin-structure.service';

describe('AdminStructureService tenant isolation', () => {
  function createService() {
    const prisma = {
      apartment: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };
    const auditService = {
      logCreate: jest.fn().mockResolvedValue(undefined),
      logUpdate: jest.fn().mockResolvedValue(undefined),
      logDelete: jest.fn().mockResolvedValue(undefined),
    };
    const limitsService = {
      assertWithinCountLimit: jest.fn().mockResolvedValue(undefined),
    };
    const service = new AdminStructureService(prisma as any, auditService as any, limitsService as any);
    return { service, prisma };
  }

  it('scopes apartment list to the admin organization', async () => {
    const { service, prisma } = createService();
    prisma.apartment.findMany.mockResolvedValue([]);
    prisma.apartment.count.mockResolvedValue(0);

    await service.listApartments({ id: 'admin-a', role: 'ADMIN', organizationId: 'org-a' } as any, {} as any);

    expect(prisma.apartment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org-a' }),
      }),
    );
  });

  it('does not update an apartment from another organization', async () => {
    const { service, prisma } = createService();
    prisma.apartment.findFirst.mockResolvedValue(null);

    await expect(
      service.updateApartment({ id: 'admin-a', role: 'ADMIN', organizationId: 'org-a' } as any, 'apt-b', { number: '99' } as any),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.apartment.update).not.toHaveBeenCalled();
  });

  it('does not delete an apartment from another organization', async () => {
    const { service, prisma } = createService();
    prisma.apartment.findFirst.mockResolvedValue(null);

    await expect(service.deleteApartment({ id: 'admin-a', role: 'ADMIN', organizationId: 'org-a' } as any, 'apt-b')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
