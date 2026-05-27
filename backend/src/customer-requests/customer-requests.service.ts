import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CustomerOnboardingRequestPriority,
  CustomerOnboardingRequestSource,
  CustomerOnboardingRequestStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCustomerOnboardingRequestDto,
  CustomerRequestAssignDto,
  CustomerRequestNoteDto,
  CustomerRequestPriorityDto,
  CustomerRequestStatusDto,
} from './dto/customer-request.dto';

@Injectable()
export class CustomerRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async createPublic(dto: CreateCustomerOnboardingRequestDto, meta?: { ip?: string; userAgent?: string; path?: string }) {
    if (!dto.consent) throw new BadRequestException('Consimtamantul este obligatoriu.');
    if (dto.website?.trim()) throw new BadRequestException('Cererea nu a putut fi trimisa.');
    const phone = dto.phone.trim();
    if (phone.length < 6 || !/^[+()\d\s.-]+$/.test(phone)) throw new BadRequestException('Telefonul nu este valid.');
    const recentCount = await this.prisma.customerOnboardingRequest.count({
      where: {
        phone,
        createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
      },
    });
    if (recentCount >= 3) {
      return { success: true, message: 'Cererea a fost trimisa.' };
    }
    await this.prisma.customerOnboardingRequest.create({
      data: {
        fullName: dto.fullName.trim(),
        phone,
        email: dto.email?.trim().toLowerCase() || null,
        associationName: dto.associationName.trim(),
        associationCode: dto.associationCode?.trim() || null,
        address: dto.address?.trim() || null,
        apartmentsCount: dto.apartmentsCount ?? null,
        role: dto.role?.trim() || null,
        currentManagementMethod: dto.currentManagementMethod?.trim() || null,
        interestedModules: (dto.interestedModules || []) as unknown as Prisma.InputJsonValue,
        preferredContactMethod: dto.preferredContactMethod?.trim() || null,
        message: dto.message?.trim() || null,
        source: dto.source || CustomerOnboardingRequestSource.PUBLIC_WEBSITE,
        status: CustomerOnboardingRequestStatus.NEW,
        priority: dto.apartmentsCount && dto.apartmentsCount >= 200 ? CustomerOnboardingRequestPriority.HIGH : CustomerOnboardingRequestPriority.NORMAL,
        metadata: {
          ip: meta?.ip,
          userAgent: meta?.userAgent?.slice(0, 300),
          path: meta?.path,
          consent: true,
        } as Prisma.InputJsonValue,
      },
    });
    return { success: true, message: 'Cererea a fost trimisa.' };
  }

  async list(filters: Record<string, string | undefined>) {
    const page = Math.max(1, Number(filters.page || 1));
    const limit = Math.min(100, Math.max(1, Number(filters.limit || 30)));
    const search = filters.search?.trim();
    const where: Prisma.CustomerOnboardingRequestWhereInput = {
      ...(filters.status ? { status: filters.status as CustomerOnboardingRequestStatus } : {}),
      ...(filters.priority ? { priority: filters.priority as CustomerOnboardingRequestPriority } : {}),
      ...(filters.source ? { source: filters.source as CustomerOnboardingRequestSource } : {}),
      ...(filters.preferredContactMethod ? { preferredContactMethod: filters.preferredContactMethod } : {}),
      ...(filters.dateFrom ? { createdAt: { gte: new Date(filters.dateFrom) } } : {}),
      ...(filters.dateTo ? { createdAt: { lte: new Date(filters.dateTo) } } : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { associationName: { contains: search, mode: 'insensitive' } },
              { associationCode: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total, stats] = await Promise.all([
      this.prisma.customerOnboardingRequest.findMany({
        where,
        include: {
          assignedTo: { select: { id: true, fullName: true, email: true } },
          convertedAssociation: { select: { id: true, name: true, legalName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.customerOnboardingRequest.count({ where }),
      this.stats(),
    ]);
    return { items, meta: { page, limit, total }, stats };
  }

  stats() {
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);
    const allStatuses = Object.values(CustomerOnboardingRequestStatus);
    return Promise.all([
      ...allStatuses.map((status) => this.prisma.customerOnboardingRequest.count({ where: { status } })),
      this.prisma.customerOnboardingRequest.count({ where: { createdAt: { gte: currentMonth } } }),
      this.prisma.customerOnboardingRequest.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    ]).then((values) => {
      const counts = Object.fromEntries(allStatuses.map((status, index) => [status, values[index] as number]));
      const last = values[allStatuses.length + 1] as { createdAt: Date } | null;
      return { ...counts, currentMonth: values[allStatuses.length] as number, lastRequestAt: last?.createdAt || null };
    });
  }

  async get(id: string) {
    const request = await this.prisma.customerOnboardingRequest.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { id: true, fullName: true, email: true } },
        convertedAssociation: { select: { id: true, name: true, legalName: true, createdAt: true } },
      },
    });
    if (!request) throw new NotFoundException('Customer request not found');
    return request;
  }

  async updateStatus(id: string, dto: CustomerRequestStatusDto) {
    await this.ensureExists(id);
    const now = new Date();
    return this.prisma.customerOnboardingRequest.update({
      where: { id },
      data: {
        status: dto.status,
        contactedAt: dto.status === CustomerOnboardingRequestStatus.CONTACTED ? now : undefined,
        qualifiedAt: dto.status === CustomerOnboardingRequestStatus.QUALIFIED ? now : undefined,
        closedAt:
          dto.status === CustomerOnboardingRequestStatus.CLOSED || dto.status === CustomerOnboardingRequestStatus.SPAM
            ? now
            : undefined,
        closeReason: dto.closeReason,
      },
    });
  }

  async updatePriority(id: string, dto: CustomerRequestPriorityDto) {
    await this.ensureExists(id);
    return this.prisma.customerOnboardingRequest.update({ where: { id }, data: { priority: dto.priority } });
  }

  async addNote(id: string, dto: CustomerRequestNoteDto) {
    const existing = await this.get(id);
    const stamped = `[${new Date().toISOString()}] ${dto.note.trim()}`;
    return this.prisma.customerOnboardingRequest.update({
      where: { id },
      data: { internalNotes: [existing.internalNotes, stamped].filter(Boolean).join('\n\n') },
    });
  }

  async assign(id: string, dto: CustomerRequestAssignDto) {
    await this.ensureExists(id);
    return this.prisma.customerOnboardingRequest.update({ where: { id }, data: { assignedToId: dto.assignedToId || null } });
  }

  async convertToAssociation(id: string) {
    const request = await this.get(id);
    if (request.convertedAssociationId) return request;
    return {
      ok: false,
      message: 'Conversia automata va fi disponibila ulterior. Creeaza asociatia din Superadmin si leag-o manual dupa confirmare.',
    };
  }

  private async ensureExists(id: string) {
    const existing = await this.prisma.customerOnboardingRequest.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('Customer request not found');
  }
}
