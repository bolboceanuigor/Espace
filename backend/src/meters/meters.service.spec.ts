import { MetersService } from './meters.service';

describe('MetersService upload security helpers', () => {
  function createService() {
    const prisma = {
      fileAsset: {
        findMany: jest.fn(),
      },
    };
    const activity = {
      createActivity: jest.fn().mockResolvedValue(undefined),
      notifyOrganizationAdmins: jest.fn().mockResolvedValue(undefined),
    };
    const service = new MetersService(prisma as any, activity as any);
    return { service, prisma };
  }

  it('maps reading proof files to secure asset ids', async () => {
    const { service, prisma } = createService();
    prisma.fileAsset.findMany.mockResolvedValue([
      { id: 'asset-1', entityId: 'reading-1', fileUrl: '/uploads/org-a/proof.png' },
    ]);

    const [reading] = await (service as any).attachReadingProofFileAssetIds('org-a', [
      { id: 'reading-1', proofFileUrl: '/uploads/org-a/proof.png' },
    ]);

    expect(reading.proofFileAssetId).toBe('asset-1');
  });
});
