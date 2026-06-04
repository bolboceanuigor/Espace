import { RbacDashboardService } from './rbac-dashboard.service';

describe('RbacDashboardService tenant isolation', () => {
  function createService() {
    const prisma = {
      organization: { findUnique: jest.fn().mockResolvedValue({ id: 'org-a', name: 'Org A' }) },
      apartment: { count: jest.fn().mockResolvedValue(12) },
      user: { count: jest.fn().mockResolvedValue(7) },
      payment: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      issue: { count: jest.fn().mockResolvedValue(3) },
    };
    const service = new RbacDashboardService(prisma as any);
    return { service, prisma };
  }

  it('keeps admin dashboard counts inside the active organization', async () => {
    const { service, prisma } = createService();

    await service.getAdminOverview({ id: 'admin-a', role: 'ADMIN', organizationId: 'org-a' } as any);

    expect(prisma.organization.findUnique).toHaveBeenCalledWith({ where: { id: 'org-a' }, select: { id: true, name: true } });
    expect(prisma.apartment.count).toHaveBeenCalledWith({ where: { organizationId: 'org-a' } });
    expect(prisma.user.count).toHaveBeenCalledWith({
      where: { organizationId: 'org-a', role: { in: ['RESIDENT', 'TENANT'] }, deletedAt: null },
    });
    expect(prisma.payment.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org-a' }),
      }),
    );
    expect(prisma.issue.count).toHaveBeenCalledWith({ where: { organizationId: 'org-a', status: { in: ['NEW', 'IN_PROGRESS', 'WAITING'] } } });
  });
});
