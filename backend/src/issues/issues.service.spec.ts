import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { IssuesService } from './issues.service';

describe('IssuesService', () => {
  function createService() {
    const prisma = {
      residentProfile: { findMany: jest.fn() },
      apartment: { findFirst: jest.fn() },
      building: { findFirst: jest.fn() },
      staircase: { findFirst: jest.fn() },
      privacySettings: { findUnique: jest.fn() },
      issue: { findFirst: jest.fn() },
      fileAsset: { findMany: jest.fn() },
    };
    const auditService = { logCreate: jest.fn(), logUpdate: jest.fn(), logDelete: jest.fn() };
    const notificationsService = { notifyUsers: jest.fn(), createNotification: jest.fn() };
    const saasLimits = { assertCanCreateRequest: jest.fn().mockResolvedValue(undefined), assertSubscriptionAllowsWrite: jest.fn().mockResolvedValue(undefined) };
    const service = new IssuesService(prisma as any, auditService as any, notificationsService as any, saasLimits as any);
    return { service, prisma };
  }

  it('rejects resident issue creation for apartments outside their scope', async () => {
    const { service, prisma } = createService();
    prisma.residentProfile.findMany.mockResolvedValue([{ apartmentId: 'apt-1' }]);

    await expect(
      service.residentCreate(
        { id: 'resident-1', role: 'RESIDENT', organizationId: 'org-1' },
        {
          apartmentId: 'apt-2',
          title: 'Sesizare',
          description: 'Detalii',
          category: 'OTHER',
          locationType: 'APARTMENT',
          priority: 'MEDIUM',
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not return issues from another organization to a resident', async () => {
    const { service, prisma } = createService();
    prisma.residentProfile.findMany.mockResolvedValue([{ apartmentId: 'apt-1' }]);
    prisma.privacySettings.findUnique.mockResolvedValue(null);
    prisma.issue.findFirst.mockResolvedValue(null);

    await expect(
      service.residentGetOne({ id: 'resident-1', role: 'RESIDENT', organizationId: 'org-1' }, 'issue-foreign'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
