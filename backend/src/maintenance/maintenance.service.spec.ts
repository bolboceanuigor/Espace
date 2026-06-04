import { NotificationType } from '@prisma/client';
import { MaintenanceService } from './maintenance.service';

describe('MaintenanceService', () => {
  function createService() {
    const prisma = {
      issue: { findFirst: jest.fn() },
      maintenanceTask: { create: jest.fn() },
      residentProfile: { findMany: jest.fn() },
      supplier: { findMany: jest.fn() },
    };
    const auditService = { logCreate: jest.fn().mockResolvedValue(undefined), logUpdate: jest.fn().mockResolvedValue(undefined) };
    const notificationsService = {
      createNotification: jest.fn().mockResolvedValue(undefined),
      notifyUsers: jest.fn().mockResolvedValue(undefined),
    };
    const service = new MaintenanceService(prisma as any, auditService as any, notificationsService as any);
    return { service, prisma, auditService, notificationsService };
  }

  it('notifies linked residents when a maintenance task is created from an issue', async () => {
    const { service, prisma, notificationsService } = createService();
    prisma.issue.findFirst
      .mockResolvedValueOnce({
        id: 'issue-1',
        title: 'Scurgere apă',
        description: 'Baie etaj 2',
        buildingId: null,
        staircaseId: null,
        priority: 'HIGH',
      })
      .mockResolvedValueOnce({ id: 'issue-1' })
      .mockResolvedValueOnce({
        id: 'issue-1',
        title: 'Scurgere apă',
        createdByUserId: 'resident-1',
        apartmentId: 'apt-1',
      });
    prisma.residentProfile.findMany.mockResolvedValue([{ userId: 'resident-1' }, { userId: 'resident-2' }]);
    prisma.maintenanceTask.create.mockResolvedValue({
      id: 'task-1',
      title: 'Reactive task: Scurgere apă',
      relatedIssueId: 'issue-1',
      assignedToUserId: null,
      status: 'NEW',
    });

    await service.createMaintenanceTaskFromIssue(
      { id: 'admin-1', role: 'ADMIN', organizationId: 'org-1' },
      'issue-1',
      {},
    );

    expect(notificationsService.notifyUsers).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        userIds: expect.arrayContaining(['resident-1', 'resident-2']),
        type: NotificationType.MAINTENANCE,
      }),
    );
  });

  it('scopes resident maintenance events to the resident organization and visibility', async () => {
    const { service, prisma } = createService();
    (prisma as any).maintenanceEvent = { findMany: jest.fn().mockResolvedValue([]) };
    prisma.residentProfile.findMany.mockResolvedValue([
      {
        apartmentId: 'apt-a',
        apartment: {
          id: 'apt-a',
          buildingId: 'building-a',
          staircaseId: 'staircase-a',
        },
      },
    ]);

    await service.listResidentMaintenanceEvents(
      { id: 'resident-a', role: 'RESIDENT', organizationId: 'org-a' } as any,
      {} as any,
    );

    expect((prisma as any).maintenanceEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: 'org-a',
          OR: [
            { targetType: 'ORGANIZATION' },
            { targetType: 'BUILDING', buildingId: { in: ['building-a'] } },
            { targetType: 'STAIRCASE', staircaseId: { in: ['staircase-a'] } },
            { targetType: 'APARTMENT', apartmentId: { in: ['apt-a'] } },
          ],
        },
      }),
    );
  });

  it('scopes service providers to the active organization when listing', async () => {
    const { service, prisma } = createService();
    (prisma as any).organizationMember = {
      findFirst: jest.fn().mockResolvedValue({ role: 'ORG_ADMIN', permissionsJson: {} }),
    };
    prisma.supplier.findMany.mockResolvedValue([]);

    await service.listSuppliers(
      { id: 'admin-a', role: 'MEMBER', organizationId: 'org-a' } as any,
      { search: 'lift' } as any,
    );

    expect(prisma.supplier.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-a',
        }),
      }),
    );
  });
});
