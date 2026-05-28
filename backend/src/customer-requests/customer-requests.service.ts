import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ClientLifecycleStage,
  ClientPriority,
  ClientSource,
  CustomerOnboardingRequestPriority,
  CustomerOnboardingRequestSource,
  CustomerOnboardingRequestStatus,
  CustomerOnboardingRequestType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCustomerOnboardingRequestDto,
  CustomerRequestAssignDto,
  CustomerRequestNoteDto,
  CustomerRequestPriorityDto,
  CustomerRequestStatusDto,
  CustomerRequestUpdateDto,
} from './dto/customer-request.dto';

@Injectable()
export class CustomerRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async createPublic(dto: CreateCustomerOnboardingRequestDto, meta?: { ip?: string; userAgent?: string; path?: string }) {
    if (!dto.consent) throw new BadRequestException('Consimtamantul este obligatoriu.');
    if (dto.website?.trim()) return { success: true, message: 'Cererea a fost trimisa. Te vom contacta pentru configurarea accesului.' };
    const contactName = (dto.contactName || dto.fullName || '').trim();
    const city = dto.city?.trim();
    if (!contactName) throw new BadRequestException('Numele persoanei de contact este obligatoriu.');
    if (!city) throw new BadRequestException('Orasul este obligatoriu.');
    const phone = dto.phone.trim();
    if (phone.length < 6 || !/^[+()\d\s.-]+$/.test(phone)) throw new BadRequestException('Telefonul nu este valid.');
    const email = dto.email?.trim().toLowerCase() || null;
    const address = dto.address?.trim() || null;
    const associationName = dto.associationName?.trim() || dto.legalName?.trim() || 'Nespecificat';
    const apcCode = dto.apcCode?.trim() || dto.associationCode?.trim() || null;
    const recentCount = await this.prisma.customerOnboardingRequest.count({
      where: {
        phone,
        createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
      },
    });
    if (recentCount >= 3) {
      return { success: true, message: 'Cererea a fost trimisa. Te vom contacta pentru configurarea accesului.' };
    }
    const duplicate = await this.findRecentDuplicate({ phone, email, city, address });
    const request = await this.prisma.customerOnboardingRequest.create({
      data: {
        type: dto.type || CustomerOnboardingRequestType.APC,
        fullName: contactName,
        phone,
        email,
        associationName,
        legalName: dto.legalName?.trim() || null,
        associationCode: apcCode,
        apcCode,
        city,
        address,
        blocksCount: dto.blocksCount ?? null,
        apartmentsCount: dto.apartmentsCount ?? null,
        role: dto.contactRole?.trim() || dto.role?.trim() || null,
        contactRole: dto.contactRole?.trim() || dto.role?.trim() || null,
        currentManagementMethod: dto.currentManagementMethod?.trim() || null,
        interestedModules: (dto.interestedModules || []) as unknown as Prisma.InputJsonValue,
        preferredContactMethod: dto.preferredContactMethod?.trim() || null,
        message: dto.message?.trim() || null,
        source: dto.source || CustomerOnboardingRequestSource.ACCESS_REQUEST,
        status: CustomerOnboardingRequestStatus.NEW,
        priority: dto.apartmentsCount && dto.apartmentsCount >= 200 ? CustomerOnboardingRequestPriority.HIGH : CustomerOnboardingRequestPriority.NORMAL,
        possibleDuplicate: !!duplicate,
        duplicateOfRequestId: duplicate?.id || null,
        metadata: {
          ip: meta?.ip,
          userAgent: meta?.userAgent?.slice(0, 300),
          path: meta?.path,
          consent: true,
          possibleDuplicate: !!duplicate,
          duplicateOfRequestId: duplicate?.id || null,
        } as Prisma.InputJsonValue,
      },
    });
    await this.prisma.clientAccount.create({
      data: {
        customerRequestId: request.id,
        displayName: request.associationName || request.legalName || request.fullName,
        lifecycleStage: ClientLifecycleStage.NEW_REQUEST,
        priority: request.priority === CustomerOnboardingRequestPriority.HIGH ? ClientPriority.HIGH : request.priority === CustomerOnboardingRequestPriority.LOW ? ClientPriority.LOW : ClientPriority.NORMAL,
        source: request.source === CustomerOnboardingRequestSource.ACCESS_REQUEST ? ClientSource.ACCESS_REQUEST : request.source === CustomerOnboardingRequestSource.REFERRAL ? ClientSource.REFERRAL : ClientSource.PUBLIC_WEBSITE,
        contactName: request.fullName,
        contactPhone: request.phone,
        contactEmail: request.email,
        associationName: request.associationName,
        associationCode: request.apcCode || request.associationCode,
        address: request.address,
        apartmentsCount: request.apartmentsCount,
        metadata: { sourceRequest: 'public_access_request', city: request.city, requestType: request.type } as Prisma.InputJsonValue,
      },
    }).catch(() => undefined);
    return { success: true, message: 'Cererea a fost trimisa. Te vom contacta pentru configurarea accesului.' };
  }

  async list(filters: Record<string, string | undefined>) {
    const page = Math.max(1, Number(filters.page || 1));
    const limit = Math.min(100, Math.max(1, Number(filters.limit || 30)));
    const search = filters.search?.trim();
    const statusFilter = this.statusWhere(filters.status);
    const where: Prisma.CustomerOnboardingRequestWhereInput = {
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(filters.type ? { type: filters.type as CustomerOnboardingRequestType } : {}),
      ...(filters.priority ? { priority: filters.priority as CustomerOnboardingRequestPriority } : {}),
      ...(filters.source ? { source: filters.source as CustomerOnboardingRequestSource } : {}),
      ...(filters.city ? { city: { contains: filters.city.trim(), mode: 'insensitive' } } : {}),
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
              { legalName: { contains: search, mode: 'insensitive' } },
              { associationCode: { contains: search, mode: 'insensitive' } },
              { apcCode: { contains: search, mode: 'insensitive' } },
              { city: { contains: search, mode: 'insensitive' } },
              { address: { contains: search, mode: 'insensitive' } },
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
    const possibleDuplicates = await this.findPossibleDuplicatesForRequest(request);
    return { ...request, possibleDuplicates };
  }

  async updateStatus(id: string, dto: CustomerRequestStatusDto) {
    await this.ensureExists(id);
    const now = new Date();
    const status = this.normalizeStatus(dto.status);
    return this.prisma.customerOnboardingRequest.update({
      where: { id },
      data: {
        status,
        contactedAt: status === CustomerOnboardingRequestStatus.CONTACTED ? now : undefined,
        lastContactedAt: status === CustomerOnboardingRequestStatus.CONTACTED ? now : undefined,
        qualifiedAt: status === CustomerOnboardingRequestStatus.QUALIFIED ? now : undefined,
        closedAt:
          status === CustomerOnboardingRequestStatus.CLOSED || status === CustomerOnboardingRequestStatus.REJECTED || status === CustomerOnboardingRequestStatus.SPAM
            ? now
            : undefined,
        closeReason: dto.closeReason,
      },
    });
  }

  async update(id: string, dto: CustomerRequestUpdateDto) {
    await this.ensureExists(id);
    const status = dto.status ? this.normalizeStatus(dto.status) : undefined;
    const lastContactedAt = dto.lastContactedAt === null || dto.lastContactedAt === '' ? null : dto.lastContactedAt ? new Date(dto.lastContactedAt) : undefined;
    const now = new Date();
    return this.prisma.customerOnboardingRequest.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(dto.priority ? { priority: dto.priority } : {}),
        ...(dto.assignedToId !== undefined ? { assignedToId: dto.assignedToId || null } : {}),
        ...(dto.internalNote !== undefined ? { internalNotes: dto.internalNote?.trim() || null } : {}),
        ...(lastContactedAt !== undefined ? { lastContactedAt, contactedAt: lastContactedAt } : {}),
        ...(status === CustomerOnboardingRequestStatus.CONTACTED ? { contactedAt: now, lastContactedAt: now } : {}),
        ...(status === CustomerOnboardingRequestStatus.QUALIFIED ? { qualifiedAt: now } : {}),
        ...(status === CustomerOnboardingRequestStatus.CLOSED || status === CustomerOnboardingRequestStatus.REJECTED || status === CustomerOnboardingRequestStatus.SPAM ? { closedAt: now } : {}),
      },
      include: {
        assignedTo: { select: { id: true, fullName: true, email: true } },
        convertedAssociation: { select: { id: true, name: true, legalName: true, createdAt: true } },
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

  private async findRecentDuplicate(input: { phone: string; email?: string | null; city?: string | null; address?: string | null }) {
    const or: Prisma.CustomerOnboardingRequestWhereInput[] = [{ phone: input.phone }];
    if (input.email) or.push({ email: input.email });
    const where: Prisma.CustomerOnboardingRequestWhereInput = {
      createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      OR: or,
      ...(input.city ? { city: { equals: input.city, mode: 'insensitive' } } : {}),
      ...(input.address ? { address: { equals: input.address, mode: 'insensitive' } } : {}),
    };
    return this.prisma.customerOnboardingRequest.findFirst({
      where,
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
  }

  private async findPossibleDuplicatesForRequest(request: { id: string; phone: string; email?: string | null; city?: string | null; address?: string | null }) {
    const or: Prisma.CustomerOnboardingRequestWhereInput[] = [{ phone: request.phone }];
    if (request.email) or.push({ email: request.email });
    if (!or.length) return [];
    return this.prisma.customerOnboardingRequest.findMany({
      where: {
        id: { not: request.id },
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        OR: or,
        ...(request.city ? { city: { equals: request.city, mode: 'insensitive' } } : {}),
        ...(request.address ? { address: { equals: request.address, mode: 'insensitive' } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, fullName: true, phone: true, email: true, associationName: true, city: true, address: true, createdAt: true, status: true },
    });
  }

  private normalizeStatus(status: CustomerOnboardingRequestStatus) {
    if (String(status) === 'IN_ONBOARDING') return CustomerOnboardingRequestStatus.ONBOARDING;
    if (String(status) === 'CLOSED') return CustomerOnboardingRequestStatus.REJECTED;
    return status;
  }

  private statusWhere(status?: string) {
    if (!status) return undefined;
    if (status === 'ONBOARDING' || status === 'IN_ONBOARDING') {
      return { in: [CustomerOnboardingRequestStatus.ONBOARDING, CustomerOnboardingRequestStatus.IN_ONBOARDING] };
    }
    if (status === 'REJECTED' || status === 'CLOSED') {
      return { in: [CustomerOnboardingRequestStatus.REJECTED, CustomerOnboardingRequestStatus.CLOSED] };
    }
    return status as CustomerOnboardingRequestStatus;
  }

  private async ensureExists(id: string) {
    const existing = await this.prisma.customerOnboardingRequest.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('Customer request not found');
  }
}
