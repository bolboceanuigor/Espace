import { BadRequestException } from '@nestjs/common';
import { FileAssetEntityType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { assertInternalFileUrl } from './file-url-policy';

type FileAssetReader = Pick<PrismaService, 'fileAsset'>;

function entityTypeWhere(entityTypes: FileAssetEntityType | FileAssetEntityType[]) {
  return Array.isArray(entityTypes) ? { in: entityTypes } : entityTypes;
}

export async function requireOwnedFileAsset(
  prisma: FileAssetReader,
  input: {
    organizationId: string;
    fileUrl: string;
    entityTypes: FileAssetEntityType | FileAssetEntityType[];
    message?: string;
  },
) {
  assertInternalFileUrl(input.fileUrl, input.message || 'Fișierul trebuie încărcat prin Espace.');
  const asset = await prisma.fileAsset.findFirst({
    where: {
      organizationId: input.organizationId,
      fileUrl: input.fileUrl,
      entityType: entityTypeWhere(input.entityTypes),
    },
    select: {
      id: true,
      entityId: true,
      entityType: true,
      fileUrl: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      organizationId: true,
    },
  });
  if (!asset) {
    throw new BadRequestException(input.message || 'Fișierul nu aparține organizației sau nu a fost încărcat prin Espace.');
  }
  return asset;
}

export async function bindOwnedFileAssetToEntity(
  prisma: FileAssetReader,
  input: {
    organizationId: string;
    fileUrl: string;
    entityType: FileAssetEntityType | FileAssetEntityType[];
    entityId: string;
    message?: string;
  },
) {
  await requireOwnedFileAsset(prisma, {
    organizationId: input.organizationId,
    fileUrl: input.fileUrl,
    entityTypes: input.entityType,
    message: input.message,
  });
  await prisma.fileAsset.updateMany({
    where: {
      organizationId: input.organizationId,
      fileUrl: input.fileUrl,
      entityType: entityTypeWhere(input.entityType),
      entityId: null,
    },
    data: { entityId: input.entityId },
  });
}
