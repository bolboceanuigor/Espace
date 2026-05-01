import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FileAssetEntityType, FileStorageProvider, Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { AuditService } from '../audit/audit.service';
import { LimitsService } from '../limits/limits.service';
import { PrismaService } from '../prisma/prisma.service';
import { UploadFileDto } from './dto/upload-file.dto';

type AuthUser = { id?: string; sub?: string; role?: string; organizationId?: string | null };

@Injectable()
export class FilesService {
  private readonly uploadRoot = path.resolve(process.cwd(), 'uploads');
  private readonly maxBytes = 10 * 1024 * 1024;
  private readonly allowedMimePrefixes = ['image/', 'application/pdf', 'text/'];

  constructor(
    private readonly prisma: PrismaService,
    private readonly limitsService: LimitsService,
    private readonly auditService: AuditService,
  ) {}

  private userId(user: AuthUser) {
    return user.id || user.sub || '';
  }

  private isSuperAdmin(user: AuthUser) {
    const role = String(user.role || '').toUpperCase();
    return role === 'SUPERADMIN' || role === 'SUPER_ADMIN';
  }

  private assertOrgUser(user: AuthUser) {
    if (!user.organizationId) throw new ForbiddenException('Organization context missing');
    return { organizationId: user.organizationId, userId: this.userId(user), role: String(user.role || '').toUpperCase() };
  }

  private async assertEntityPermission(user: AuthUser, dto: UploadFileDto) {
    const actor = this.assertOrgUser(user);
    const isAdmin = actor.role === 'ADMIN';
    const isResident = actor.role === 'RESIDENT' || actor.role === 'TENANT';
    if (!isAdmin && !isResident && !this.isSuperAdmin(user)) {
      throw new ForbiddenException('Unsupported uploader role');
    }
    const residentAllowedTypes: FileAssetEntityType[] = [
      FileAssetEntityType.ISSUE_ATTACHMENT,
      FileAssetEntityType.RECEIPT_PDF,
      FileAssetEntityType.OTHER,
    ];
    if (isResident && !residentAllowedTypes.includes(dto.entityType)) {
      throw new ForbiddenException('File type not allowed for resident');
    }
    if (dto.entityId) {
      if (dto.entityType === FileAssetEntityType.ISSUE_ATTACHMENT) {
        const issue = await this.prisma.issue.findFirst({
          where: { id: dto.entityId, organizationId: actor.organizationId },
          select: { id: true, createdByUserId: true },
        });
        if (!issue) throw new NotFoundException('Issue not found');
        if (isResident && issue.createdByUserId !== actor.userId) {
          throw new ForbiddenException('Cannot upload attachment to this issue');
        }
      }
      if (dto.entityType === FileAssetEntityType.EXPENSE_ATTACHMENT) {
        const expense = await this.prisma.expense.findFirst({
          where: { id: dto.entityId, organizationId: actor.organizationId },
          select: { id: true },
        });
        if (!expense) throw new NotFoundException('Expense not found');
      }
    }
    return actor;
  }

  private async saveLocalFile(file: Express.Multer.File, organizationId: string) {
    const ext = path.extname(file.originalname || '') || '';
    const dateFolder = new Date().toISOString().slice(0, 10);
    const relativeDir = path.join(organizationId, dateFolder);
    const absoluteDir = path.join(this.uploadRoot, relativeDir);
    await fs.mkdir(absoluteDir, { recursive: true });
    const safeName = `${Date.now()}-${randomUUID()}${ext}`;
    const absolutePath = path.join(absoluteDir, safeName);
    await fs.writeFile(absolutePath, file.buffer);
    const relativePath = path.join(relativeDir, safeName).replaceAll(path.sep, '/');
    return {
      absolutePath,
      fileUrl: `/uploads/${relativePath}`,
    };
  }

  private resolveAbsolutePath(fileUrl: string) {
    const relative = fileUrl.replace(/^\/uploads\//, '');
    return path.join(this.uploadRoot, relative);
  }

  private validateFile(file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('File is required');
    if (!file.originalname) throw new BadRequestException('File name is required');
    if (!file.mimetype) throw new BadRequestException('Unsupported file type');
    const allowed = this.allowedMimePrefixes.some((entry) => file.mimetype.startsWith(entry));
    if (!allowed) throw new BadRequestException('Unsupported file type');
    if (file.size <= 0 || file.size > this.maxBytes) {
      throw new BadRequestException('File size exceeds allowed limit');
    }
  }

  async adminUpload(user: AuthUser, dto: UploadFileDto, file?: Express.Multer.File) {
    const actor = await this.assertEntityPermission(user, dto);
    if (actor.role !== 'ADMIN' && !this.isSuperAdmin(user)) throw new ForbiddenException('Admin access required');
    this.validateFile(file);
    await this.limitsService.assertStorageAllowance(user, actor.organizationId, Number((file!.size / (1024 * 1024)).toFixed(4)));
    const saved = await this.saveLocalFile(file!, actor.organizationId);
    return this.prisma.fileAsset.create({
      data: {
        organizationId: actor.organizationId,
        uploadedByUserId: actor.userId,
        entityType: dto.entityType,
        entityId: dto.entityId || null,
        fileName: file!.originalname,
        fileUrl: saved.fileUrl,
        mimeType: file!.mimetype,
        sizeBytes: file!.size,
        storageProvider: FileStorageProvider.LOCAL,
      },
    });
  }

  async residentUpload(user: AuthUser, dto: UploadFileDto, file?: Express.Multer.File) {
    const actor = await this.assertEntityPermission(user, dto);
    if (actor.role !== 'RESIDENT' && actor.role !== 'TENANT') throw new ForbiddenException('Resident access required');
    this.validateFile(file);
    await this.limitsService.assertStorageAllowance(user, actor.organizationId, Number((file!.size / (1024 * 1024)).toFixed(4)));
    const saved = await this.saveLocalFile(file!, actor.organizationId);
    return this.prisma.fileAsset.create({
      data: {
        organizationId: actor.organizationId,
        uploadedByUserId: actor.userId,
        entityType: dto.entityType,
        entityId: dto.entityId || null,
        fileName: file!.originalname,
        fileUrl: saved.fileUrl,
        mimeType: file!.mimetype,
        sizeBytes: file!.size,
        storageProvider: FileStorageProvider.LOCAL,
      },
    });
  }

  async adminList(user: AuthUser) {
    const actor = this.assertOrgUser(user);
    if (actor.role !== 'ADMIN') throw new ForbiddenException('Admin access required');
    return this.prisma.fileAsset.findMany({
      where: { organizationId: actor.organizationId },
      orderBy: { createdAt: 'desc' },
      include: { uploadedBy: { select: { id: true, email: true, firstName: true, lastName: true } } },
    });
  }

  async adminDelete(user: AuthUser, id: string) {
    const actor = this.assertOrgUser(user);
    if (actor.role !== 'ADMIN') throw new ForbiddenException('Admin access required');
    const asset = await this.prisma.fileAsset.findFirst({ where: { id, organizationId: actor.organizationId } });
    if (!asset) throw new NotFoundException('File not found');
    const absolutePath = this.resolveAbsolutePath(asset.fileUrl);
    await fs.unlink(absolutePath).catch(() => undefined);
    await this.prisma.fileAsset.delete({ where: { id } });
    return { ok: true };
  }

  private async canResidentAccessDocument(organizationId: string, userId: string, documentId: string) {
    const profiles = await this.prisma.residentProfile.findMany({
      where: { organizationId, userId },
      select: { apartmentId: true, apartment: { select: { buildingId: true, staircaseId: true } } },
    });
    const apartmentIds = profiles.map((profile) => profile.apartmentId);
    const buildingIds = profiles.map((profile) => profile.apartment.buildingId);
    const staircaseIds = profiles.map((profile) => profile.apartment.staircaseId);
    const document = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        organizationId,
        OR: [
          { targetType: 'ORGANIZATION' },
          { targetType: 'BUILDING', buildingId: { in: buildingIds.length ? buildingIds : ['__none__'] } },
          { targetType: 'STAIRCASE', staircaseId: { in: staircaseIds.length ? staircaseIds : ['__none__'] } },
          { targetType: 'APARTMENT', apartmentId: { in: apartmentIds.length ? apartmentIds : ['__none__'] } },
        ],
      },
      select: { id: true },
    });
    return Boolean(document);
  }

  private async canResidentAccessInvoiceOrReceipt(
    organizationId: string,
    userId: string,
    entityType: FileAssetEntityType,
    entityId?: string | null,
  ) {
    if (!entityId) return false;
    const residentApartments = await this.prisma.residentProfile.findMany({
      where: { organizationId, userId },
      select: { apartmentId: true },
    });
    const apartmentIds = residentApartments.map((entry) => entry.apartmentId);
    if (!apartmentIds.length) return false;
    if (entityType === FileAssetEntityType.INVOICE_PDF) {
      const invoice = await this.prisma.residentInvoice.findFirst({
        where: { id: entityId, organizationId, apartmentId: { in: apartmentIds } },
        select: { id: true },
      });
      return Boolean(invoice);
    }
    if (entityType === FileAssetEntityType.RECEIPT_PDF) {
      const receipt = await this.prisma.receipt.findFirst({
        where: { id: entityId, organizationId, apartmentId: { in: apartmentIds } },
        select: { id: true },
      });
      return Boolean(receipt);
    }
    return false;
  }

  private async canResidentAccessIssueAttachment(organizationId: string, userId: string, issueId?: string | null) {
    if (!issueId) return false;
    const issue = await this.prisma.issue.findFirst({
      where: { id: issueId, organizationId, createdByUserId: userId },
      select: { id: true },
    });
    return Boolean(issue);
  }

  private async canSuperadminAccess(user: AuthUser, organizationId?: string | null) {
    if (!this.isSuperAdmin(user)) return false;
    if (!organizationId) return true;
    const active = await this.prisma.supportSession.findFirst({
      where: { superAdminUserId: this.userId(user), organizationId, isActive: true },
      select: { id: true },
    });
    return Boolean(active);
  }

  private async assertDownloadAccess(user: AuthUser, asset: { organizationId?: string | null; entityType: FileAssetEntityType; entityId?: string | null }) {
    const role = String(user.role || '').toUpperCase();
    const organizationId = user.organizationId || null;
    const userId = this.userId(user);

    if (await this.canSuperadminAccess(user, asset.organizationId)) {
      return;
    }

    if (role === Role.ADMIN) {
      if (!organizationId || organizationId !== asset.organizationId) {
        throw new ForbiddenException('File access denied');
      }
      return;
    }

    if (role === Role.RESIDENT || role === Role.TENANT) {
      if (!organizationId || organizationId !== asset.organizationId) {
        throw new ForbiddenException('File access denied');
      }
      if (asset.entityType === FileAssetEntityType.DOCUMENT) {
        const ok = await this.canResidentAccessDocument(organizationId, userId, asset.entityId || '');
        if (!ok) throw new ForbiddenException('File access denied');
        return;
      }
      if (asset.entityType === FileAssetEntityType.ISSUE_ATTACHMENT) {
        const ok = await this.canResidentAccessIssueAttachment(organizationId, userId, asset.entityId);
        if (!ok) throw new ForbiddenException('File access denied');
        return;
      }
      const invoiceReceiptTypes: FileAssetEntityType[] = [FileAssetEntityType.INVOICE_PDF, FileAssetEntityType.RECEIPT_PDF];
      if (invoiceReceiptTypes.includes(asset.entityType)) {
        const ok = await this.canResidentAccessInvoiceOrReceipt(organizationId, userId, asset.entityType, asset.entityId);
        if (!ok) throw new ForbiddenException('File access denied');
        return;
      }
      throw new ForbiddenException('File access denied');
    }

    throw new ForbiddenException('File access denied');
  }

  async getDownloadableFile(user: AuthUser, id: string) {
    const asset = await this.prisma.fileAsset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('File not found');
    await this.assertDownloadAccess(user, asset);
    const absolutePath = this.resolveAbsolutePath(asset.fileUrl);
    await fs.access(absolutePath).catch(() => {
      throw new NotFoundException('File content missing');
    });

    const sensitiveTypes: FileAssetEntityType[] = [
      FileAssetEntityType.DOCUMENT,
      FileAssetEntityType.INVOICE_PDF,
      FileAssetEntityType.RECEIPT_PDF,
    ];
    const sensitive = sensitiveTypes.includes(asset.entityType);
    if (sensitive || asset.fileName.toLowerCase().includes('backup')) {
      await this.auditService.logAction({
        userId: this.userId(user),
        organizationId: asset.organizationId || undefined,
        action: 'FILE_DOWNLOAD',
        entityType: 'FILE_ASSET',
        entityId: id,
        description: `Downloaded file ${asset.fileName}`,
      });
    }

    return {
      absolutePath,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
    };
  }

  async superadminStorage() {
    const grouped = await this.prisma.fileAsset.groupBy({
      by: ['organizationId'],
      _sum: { sizeBytes: true },
      _count: { _all: true },
    });
    const organizationIds = grouped.map((entry) => entry.organizationId).filter((value): value is string => Boolean(value));
    const [orgs, limits] = await Promise.all([
      this.prisma.organization.findMany({ where: { id: { in: organizationIds } }, select: { id: true, name: true } }),
      this.prisma.organizationLimits.findMany({ where: { organizationId: { in: organizationIds } }, select: { organizationId: true, maxStorageMb: true } }),
    ]);
    const orgMap = new Map(orgs.map((org) => [org.id, org]));
    const limitsMap = new Map(limits.map((item) => [item.organizationId, item.maxStorageMb]));
    return grouped.map((entry) => ({
      organizationId: entry.organizationId,
      organizationName: entry.organizationId ? orgMap.get(entry.organizationId)?.name || 'Unknown' : 'No organization',
      filesCount: entry._count._all,
      usedBytes: Number(entry._sum.sizeBytes || 0),
      usedMb: Number(((Number(entry._sum.sizeBytes || 0)) / (1024 * 1024)).toFixed(2)),
      maxStorageMb: entry.organizationId ? limitsMap.get(entry.organizationId) ?? null : null,
    }));
  }

  async superadminOrgStorage(organizationId: string) {
    const [usage, limits, files] = await Promise.all([
      this.prisma.fileAsset.aggregate({
        where: { organizationId },
        _sum: { sizeBytes: true },
        _count: { _all: true },
      }),
      this.prisma.organizationLimits.findUnique({ where: { organizationId }, select: { maxStorageMb: true } }),
      this.prisma.fileAsset.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        include: { uploadedBy: { select: { id: true, email: true, firstName: true, lastName: true, role: true } } },
      }),
    ]);
    return {
      organizationId,
      usedBytes: Number(usage._sum.sizeBytes || 0),
      usedMb: Number((Number(usage._sum.sizeBytes || 0) / (1024 * 1024)).toFixed(2)),
      filesCount: usage._count._all,
      maxStorageMb: limits?.maxStorageMb ?? null,
      files,
    };
  }
}

