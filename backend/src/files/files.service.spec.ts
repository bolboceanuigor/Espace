import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { FileAssetEntityType } from '@prisma/client';
import { promises as fs } from 'fs';
import { FilesService } from './files.service';

function mockFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'document.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 1024,
    buffer: Buffer.from('%PDF-1.7 test'),
    stream: undefined as never,
    destination: '',
    filename: '',
    path: '',
    ...overrides,
  };
}

describe('FilesService', () => {
  function createService() {
    const prisma = {
      issue: { findFirst: jest.fn() },
      expense: { findFirst: jest.fn() },
      fileAsset: { create: jest.fn(), findUnique: jest.fn() },
      residentProfile: { findMany: jest.fn() },
      document: { findFirst: jest.fn() },
      residentInvoice: { findFirst: jest.fn() },
      receipt: { findFirst: jest.fn() },
      paymentProof: { findFirst: jest.fn() },
      supportSession: { findFirst: jest.fn() },
    };
    const limitsService = { assertStorageAllowance: jest.fn().mockResolvedValue(undefined) };
    const auditService = { logAction: jest.fn().mockResolvedValue(undefined) };
    const service = new FilesService(prisma as any, limitsService as any, auditService as any);
    return { service, prisma, limitsService, auditService };
  }

  it('rejects unsupported upload types for resident issue attachments', async () => {
    const { service, prisma } = createService();
    prisma.issue.findFirst.mockResolvedValue({ id: 'issue-1', createdByUserId: 'resident-1' });

    await expect(
      service.residentUpload(
        { id: 'resident-1', role: 'RESIDENT', organizationId: 'org-1' },
        { entityType: FileAssetEntityType.ISSUE_ATTACHMENT, entityId: 'issue-1' },
        mockFile({ originalname: 'script.sh', mimetype: 'text/x-shellscript' }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('stores allowed uploads with a randomized internal path', async () => {
    const { service, prisma, limitsService } = createService();
    prisma.fileAsset.create.mockResolvedValue({ id: 'asset-1', fileUrl: '/uploads/org-1/2026-06-03/random.pdf' });
    jest.spyOn(service as any, 'saveLocalFile').mockResolvedValue({
      absolutePath: '/tmp/random.pdf',
      fileUrl: '/uploads/org-1/2026-06-03/random.pdf',
    });

    await service.adminUpload(
      { id: 'admin-1', role: 'ADMIN', organizationId: 'org-1' },
      { entityType: FileAssetEntityType.DOCUMENT },
      mockFile(),
    );

    expect(limitsService.assertStorageAllowance).toHaveBeenCalled();
    expect(prisma.fileAsset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-1',
          entityType: FileAssetEntityType.DOCUMENT,
          fileUrl: '/uploads/org-1/2026-06-03/random.pdf',
          fileName: 'document.pdf',
        }),
      }),
    );
  });

  it('rejects files whose declared MIME does not match the real content', async () => {
    const { service } = createService();

    await expect(
      service.adminUpload(
        { id: 'admin-1', role: 'ADMIN', organizationId: 'org-1' },
        { entityType: FileAssetEntityType.DOCUMENT },
        mockFile({
          originalname: 'document.pdf',
          mimetype: 'application/pdf',
          buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects uploads that exceed the configured size limit', async () => {
    const { service } = createService();

    await expect(
      service.adminUpload(
        { id: 'admin-1', role: 'ADMIN', organizationId: 'org-1' },
        { entityType: FileAssetEntityType.DOCUMENT },
        mockFile({ size: 11 * 1024 * 1024 }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks resident download for files from another organization', async () => {
    const { service, prisma } = createService();
    prisma.fileAsset.findUnique.mockResolvedValue({
      id: 'asset-1',
      organizationId: 'org-2',
      entityType: FileAssetEntityType.ISSUE_ATTACHMENT,
      entityId: 'issue-1',
      fileUrl: '/uploads/org-2/2026-06-03/proof.pdf',
      fileName: 'proof.pdf',
      mimeType: 'application/pdf',
    });

    await expect(
      service.getDownloadableFile({ id: 'resident-1', role: 'RESIDENT', organizationId: 'org-1' }, 'asset-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks path traversal on stored file paths', async () => {
    const { service, prisma } = createService();
    prisma.fileAsset.findUnique.mockResolvedValue({
      id: 'asset-1',
      organizationId: 'org-1',
      entityType: FileAssetEntityType.DOCUMENT,
      entityId: 'doc-1',
      fileUrl: '/uploads/../../etc/passwd',
      fileName: 'proof.pdf',
      mimeType: 'application/pdf',
    });

    await expect(
      service.getDownloadableFile({ id: 'admin-1', role: 'ADMIN', organizationId: 'org-1' }, 'asset-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows an admin to download files from the same organization', async () => {
    const { service, prisma } = createService();
    prisma.fileAsset.findUnique.mockResolvedValue({
      id: 'asset-1',
      organizationId: 'org-1',
      entityType: FileAssetEntityType.DOCUMENT,
      entityId: 'doc-1',
      fileUrl: '/uploads/org-1/2026-06-03/proof.pdf',
      fileName: 'proof.pdf',
      mimeType: 'application/pdf',
    });
    jest.spyOn(service as any, 'resolveAbsolutePath').mockReturnValue('/tmp/proof.pdf');
    jest.spyOn(fs, 'access').mockResolvedValue(undefined);

    const result = await service.getDownloadableFile({ id: 'admin-1', role: 'ADMIN', organizationId: 'org-1' }, 'asset-1');

    expect(result).toEqual({
      absolutePath: '/tmp/proof.pdf',
      fileName: 'proof.pdf',
      mimeType: 'application/pdf',
    });
  });

  it('allows superadmin download only with an active support session', async () => {
    const { service, prisma } = createService();
    prisma.fileAsset.findUnique.mockResolvedValue({
      id: 'asset-1',
      organizationId: 'org-1',
      entityType: FileAssetEntityType.DOCUMENT,
      entityId: 'doc-1',
      fileUrl: '/uploads/org-1/2026-06-03/proof.pdf',
      fileName: 'proof.pdf',
      mimeType: 'application/pdf',
    });
    prisma.supportSession.findFirst.mockResolvedValue({ id: 'session-1' });
    jest.spyOn(service as any, 'resolveAbsolutePath').mockReturnValue('/tmp/proof.pdf');
    jest.spyOn(fs, 'access').mockResolvedValue(undefined);

    const result = await service.getDownloadableFile({ id: 'super-1', role: 'SUPERADMIN', organizationId: null }, 'asset-1');

    expect(result.fileName).toBe('proof.pdf');
    expect(prisma.supportSession.findFirst).toHaveBeenCalled();
  });
});
