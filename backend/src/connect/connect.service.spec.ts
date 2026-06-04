import { BadRequestException } from '@nestjs/common';
import { ConnectMessageStatus, ConnectMessageType, ConnectSenderRole, ConnectConversationStatus } from '@prisma/client';
import { ConnectService } from './connect.service';

describe('ConnectService attachment hardening', () => {
  function createService() {
    const prisma = {
      organizationMember: { findFirst: jest.fn() },
      connectConversation: { findFirst: jest.fn(), update: jest.fn() },
      connectMessage: { create: jest.fn(), findMany: jest.fn() },
      residentProfile: { findMany: jest.fn() },
      fileAsset: { findUnique: jest.fn(), findMany: jest.fn() },
      notificationPreference: { findMany: jest.fn() },
      notification: { createMany: jest.fn() },
      user: { findMany: jest.fn(), findUnique: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const notificationsService = {
      createNotification: jest.fn().mockResolvedValue(undefined),
    };
    const filesService = {
      getDownloadableFile: jest.fn().mockResolvedValue({
        absolutePath: '/tmp/proof.pdf',
        fileName: 'proof.pdf',
        mimeType: 'application/pdf',
      }),
    };
    const service = new ConnectService(prisma as any, notificationsService as any, filesService as any);
    jest.spyOn(service as any, 'notifyResident').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'notifyAdmins').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'audit').mockResolvedValue(undefined);
    return { service, prisma, filesService };
  }

  it('rejects arbitrary attachment URLs for resident messages', async () => {
    const { service, prisma } = createService();
    prisma.residentProfile.findMany.mockResolvedValue([{ apartmentId: 'apt-1' }]);
    prisma.connectConversation.findFirst.mockResolvedValue({
      id: 'conv-1',
      organizationId: 'org-1',
      residentUserId: 'resident-1',
      status: ConnectConversationStatus.OPEN,
    });

    await expect(
      service.residentSendMessage(
        { id: 'resident-1', role: 'RESIDENT', organizationId: 'org-1' },
        'conv-1',
        { body: 'Am atașat un fișier', attachmentUrl: '/uploads/org-1/2026-06-04/proof.pdf' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.connectMessage.create).not.toHaveBeenCalled();
  });

  it('stores only secure attachment links for resident messages', async () => {
    const { service, prisma, filesService } = createService();
    prisma.residentProfile.findMany.mockResolvedValue([{ apartmentId: 'apt-1' }]);
    prisma.connectConversation.findFirst.mockResolvedValue({
      id: 'conv-1',
      organizationId: 'org-1',
      residentUserId: 'resident-1',
      status: ConnectConversationStatus.OPEN,
    });
    prisma.fileAsset.findUnique.mockResolvedValue({
      id: 'asset-1',
      organizationId: 'org-1',
      fileName: 'proof.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 2048,
    });
    prisma.connectMessage.create.mockResolvedValue({
      id: 'msg-1',
      conversationId: 'conv-1',
      organizationId: 'org-1',
      senderId: 'resident-1',
      senderRole: ConnectSenderRole.RESIDENT,
      messageType: ConnectMessageType.ATTACHMENT,
      body: 'Am atașat un fișier',
      attachmentUrl: 'https://api.espace.md/files/asset-1/download',
      attachmentFileName: 'proof.pdf',
      attachmentMimeType: 'application/pdf',
      attachmentFileSize: 2048,
      status: ConnectMessageStatus.DELIVERED,
      deliveredAt: new Date(),
      sender: { firstName: 'Ana', lastName: 'Resident', fullName: 'Ana Resident', email: 'ana@example.com', role: 'RESIDENT' },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await service.residentSendMessage(
      { id: 'resident-1', role: 'RESIDENT', organizationId: 'org-1' },
      'conv-1',
      { body: 'Am atașat un fișier', attachmentUrl: 'https://api.espace.md/files/asset-1/download' },
    );

    expect(filesService.getDownloadableFile).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'resident-1', organizationId: 'org-1' }),
      'asset-1',
    );
    expect(prisma.connectMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          attachmentUrl: expect.stringContaining('/files/asset-1/download'),
          attachmentFileName: 'proof.pdf',
          attachmentMimeType: 'application/pdf',
          attachmentFileSize: 2048,
          messageType: ConnectMessageType.ATTACHMENT,
        }),
      }),
    );
  });
});
