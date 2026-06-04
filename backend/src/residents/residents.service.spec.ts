import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ResidentsService } from './residents.service';

describe('ResidentsService tenant isolation', () => {
  function createService() {
    const prisma = {
      residentProfile: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    };
    const activity = {
      createActivity: jest.fn().mockResolvedValue(undefined),
      createNotification: jest.fn().mockResolvedValue(undefined),
      notifyResidentProfile: jest.fn().mockResolvedValue(undefined),
    };
    const service = new ResidentsService(prisma as any, activity as any);
    return { service, prisma };
  }

  it('requires organization scope for superadmin on tenant resident list', async () => {
    const { service, prisma } = createService();

    await expect(service.listResidents({ id: 'sa-1', role: 'SUPERADMIN' } as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.residentProfile.findMany).not.toHaveBeenCalled();
  });

  it('scopes superadmin resident list to the selected organization', async () => {
    const { service, prisma } = createService();
    prisma.residentProfile.findMany.mockResolvedValue([]);

    await service.listResidents({ id: 'sa-1', role: 'SUPERADMIN', organizationId: 'org-a' } as any);

    expect(prisma.residentProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-a' },
      }),
    );
  });

  it('returns not found for cross-tenant resident detail access', async () => {
    const { service, prisma } = createService();
    prisma.residentProfile.findFirst.mockResolvedValue(null);

    await expect(
      service.getAdminResident({ id: 'admin-a', role: 'ADMIN', organizationId: 'org-a' } as any, 'resident-b'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.residentProfile.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'resident-b', organizationId: 'org-a' },
      }),
    );
  });
});
