import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommunityReadService } from './community-read.service';

describe('CommunityReadService tenant isolation', () => {
  function createService() {
    const prisma = {
      issue: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      fileAsset: {
        findMany: jest.fn(),
      },
    };
    const activity = {
      createActivity: jest.fn().mockResolvedValue(undefined),
      notifyResidentProfile: jest.fn().mockResolvedValue(undefined),
    };
    const service = new CommunityReadService(prisma as any, activity as any);
    return { service, prisma };
  }

  it('requires organization scope for superadmin on tenant issue list', async () => {
    const { service, prisma } = createService();

    await expect(service.listIssues({ id: 'sa-1', role: 'SUPERADMIN' } as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.issue.findMany).not.toHaveBeenCalled();
  });

  it('scopes superadmin issue list to the selected organization', async () => {
    const { service, prisma } = createService();
    prisma.issue.findMany.mockResolvedValue([]);

    await service.listIssues({ id: 'sa-1', role: 'SUPERADMIN', organizationId: 'org-a' } as any);

    expect(prisma.issue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-a' },
      }),
    );
  });

  it('returns not found for cross-tenant issue access by admin', async () => {
    const { service, prisma } = createService();
    prisma.issue.findFirst.mockResolvedValue(null);

    await expect(service.getIssue({ id: 'admin-a', role: 'ADMIN', organizationId: 'org-a' } as any, 'issue-b')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(prisma.issue.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'issue-b', organizationId: 'org-a' },
      }),
    );
  });

  it('maps request attachments to secure file asset ids', async () => {
    const { service, prisma } = createService();
    prisma.fileAsset.findMany.mockResolvedValue([
      { id: 'asset-1', entityId: 'req-1', fileUrl: '/uploads/org-a/request-proof.pdf' },
    ]);

    const [item] = await (service as any).attachRequestFileAssetIds('org-a', [
      {
        id: 'req-1',
        attachmentUrl: '/uploads/org-a/request-proof.pdf',
        attachment: { fileUrl: '/uploads/org-a/request-proof.pdf' },
        attachments: [{ fileUrl: '/uploads/org-a/request-proof.pdf' }],
      },
    ]);

    expect(item.attachmentFileAssetId).toBe('asset-1');
    expect(item.attachment?.fileAssetId).toBe('asset-1');
    expect(item.attachments?.[0]?.fileAssetId).toBe('asset-1');
  });
});
