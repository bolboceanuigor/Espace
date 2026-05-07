import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ApartmentResidentRole, ApartmentStatus, OnboardingStatus, Prisma, ResidentAccountStatus, ResidentType, Role } from '@prisma/client';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';
import type { MvpUser } from '../security/mvp-auth.guard';

@Injectable()
export class SetupService {
  constructor(private readonly prisma: PrismaService) {}

  private isSuperadmin(user: MvpUser) {
    return String(user.role).toUpperCase() === Role.SUPERADMIN;
  }

  private resolveOrganizationId(user: MvpUser, activeOrganizationId?: string, payload?: Record<string, unknown>) {
    if (!this.isSuperadmin(user)) return user.organizationId;
    const requested =
      this.optionalString(payload?.organizationId) ||
      this.optionalString(activeOrganizationId) ||
      this.optionalString(user.organizationId);
    if (!requested) throw new BadRequestException('Asociația este obligatorie.');
    return requested;
  }

  private assertOrganizationAccess(user: MvpUser, organizationId: string) {
    if (!this.isSuperadmin(user) && organizationId !== user.organizationId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_ORGANIZATION',
        message: 'Nu ai acces la aceste date.',
      });
    }
  }

  private async assertOrganizationExists(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!organization) throw new NotFoundException('Înregistrarea nu a fost găsită.');
  }

  private buildingSelect(): Prisma.BuildingSelect {
    return {
      id: true,
      organizationId: true,
      name: true,
      address: true,
      cadastralNumber: true,
      totalFloors: true,
      staircasesCount: true,
      apartmentsCount: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          staircases: true,
          apartments: true,
        },
      },
    };
  }

  private buildingDetailSelect(): Prisma.BuildingSelect {
    return {
      ...this.buildingSelect(),
      staircases: {
        orderBy: [{ name: 'asc' }],
        select: {
          id: true,
          name: true,
          floorsCount: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { apartments: true },
          },
        },
      },
      apartments: {
        orderBy: [{ staircase: { name: 'asc' } }, { floor: 'asc' }, { number: 'asc' }],
        select: {
          id: true,
          number: true,
          floor: true,
          areaM2: true,
          rooms: true,
          status: true,
          staircase: {
            select: {
              id: true,
              name: true,
            },
          },
          apartmentResidents: {
            select: {
              role: true,
              resident: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      },
    };
  }

  private staircaseSelect(): Prisma.StaircaseSelect {
    return {
      id: true,
      organizationId: true,
      buildingId: true,
      name: true,
      floorsCount: true,
      createdAt: true,
      updatedAt: true,
      building: {
        select: {
          id: true,
          name: true,
          address: true,
        },
      },
      _count: {
        select: {
          apartments: true,
        },
      },
    };
  }

  async listBuildings(user: MvpUser, activeOrganizationId?: string) {
    const organizationId = this.resolveOrganizationId(user, activeOrganizationId);
    this.assertOrganizationAccess(user, organizationId);
    await this.assertOrganizationExists(organizationId);

    return this.prisma.building.findMany({
      where: { organizationId },
      orderBy: [{ createdAt: 'desc' }],
      select: this.buildingSelect(),
    });
  }

  async createBuilding(user: MvpUser, body: unknown, activeOrganizationId?: string) {
    const payload = this.payload(body);
    const organizationId = this.resolveOrganizationId(user, activeOrganizationId, payload);
    this.assertOrganizationAccess(user, organizationId);
    await this.assertOrganizationExists(organizationId);

    const name = this.requiredString(payload.name, 'Numele blocului este obligatoriu.');
    const address = this.requiredString(payload.address, 'Adresa blocului este obligatorie.');
    const staircasesCount = this.optionalInt(payload.staircasesCount, 0);
    const apartmentsCount = this.optionalInt(payload.apartmentsCount, 0);
    const totalFloors = this.optionalInt(payload.totalFloors, 0);

    return this.prisma.building.create({
      data: {
        organizationId,
        name,
        address,
        cadastralNumber: this.optionalString(payload.cadastralNumber) || null,
        totalFloors,
        staircasesCount,
        apartmentsCount,
      },
      select: this.buildingSelect(),
    });
  }

  async getBuilding(user: MvpUser, id: string, activeOrganizationId?: string) {
    const organizationId = this.resolveOrganizationId(user, activeOrganizationId);
    this.assertOrganizationAccess(user, organizationId);

    const building = await this.prisma.building.findFirst({
      where: { id, organizationId },
      select: this.buildingDetailSelect(),
    });
    if (!building) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    return building;
  }

  async updateBuilding(user: MvpUser, id: string, body: unknown, activeOrganizationId?: string) {
    const payload = this.payload(body);
    const organizationId = this.resolveOrganizationId(user, activeOrganizationId, payload);
    this.assertOrganizationAccess(user, organizationId);

    const existing = await this.prisma.building.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Înregistrarea nu a fost găsită.');

    const data: {
      name?: string;
      address?: string;
      cadastralNumber?: string | null;
      totalFloors?: number;
      staircasesCount?: number;
      apartmentsCount?: number;
    } = {};
    if (payload.name !== undefined) data.name = this.requiredString(payload.name, 'Numele blocului este obligatoriu.');
    if (payload.address !== undefined) data.address = this.requiredString(payload.address, 'Adresa blocului este obligatorie.');
    if (payload.cadastralNumber !== undefined) data.cadastralNumber = this.optionalString(payload.cadastralNumber) || null;
    if (payload.totalFloors !== undefined) data.totalFloors = this.optionalInt(payload.totalFloors, 0);
    if (payload.staircasesCount !== undefined) data.staircasesCount = this.optionalInt(payload.staircasesCount, 0);
    if (payload.apartmentsCount !== undefined) data.apartmentsCount = this.optionalInt(payload.apartmentsCount, 0);
    if (!Object.keys(data).length) throw new BadRequestException('Nu există date de actualizat.');

    return this.prisma.building.update({
      where: { id },
      data,
      select: this.buildingSelect(),
    });
  }

  async listAllStaircases(user: MvpUser, activeOrganizationId?: string) {
    const organizationId = this.resolveOrganizationId(user, activeOrganizationId);
    this.assertOrganizationAccess(user, organizationId);
    await this.assertOrganizationExists(organizationId);

    return this.prisma.staircase.findMany({
      where: { organizationId },
      orderBy: [{ building: { name: 'asc' } }, { name: 'asc' }],
      select: this.staircaseSelect(),
    });
  }

  async listStaircases(user: MvpUser, buildingId: string, activeOrganizationId?: string) {
    const organizationId = this.resolveOrganizationId(user, activeOrganizationId);
    this.assertOrganizationAccess(user, organizationId);
    await this.assertBuildingInOrganization(buildingId, organizationId);

    return this.prisma.staircase.findMany({
      where: { buildingId, organizationId },
      orderBy: [{ name: 'asc' }],
      select: this.staircaseSelect(),
    });
  }

  async createStaircase(user: MvpUser, buildingId: string, body: unknown, activeOrganizationId?: string) {
    const payload = this.payload(body);
    const organizationId = this.resolveOrganizationId(user, activeOrganizationId, payload);
    this.assertOrganizationAccess(user, organizationId);
    await this.assertBuildingInOrganization(buildingId, organizationId);

    const name = this.requiredString(payload.name, 'Numele scării este obligatoriu.');
    const floorsCount = this.optionalInt(payload.floorsCount, 0);

    const staircase = await this.prisma.staircase.create({
      data: {
        organizationId,
        buildingId,
        name,
        floorsCount,
      },
      select: this.staircaseSelect(),
    });
    await this.syncBuildingCounters(buildingId);
    return staircase;
  }

  async updateStaircase(user: MvpUser, id: string, body: unknown, activeOrganizationId?: string) {
    const payload = this.payload(body);
    const organizationId = this.resolveOrganizationId(user, activeOrganizationId, payload);
    this.assertOrganizationAccess(user, organizationId);

    const existing = await this.prisma.staircase.findFirst({
      where: { id, organizationId },
      select: { id: true, buildingId: true },
    });
    if (!existing) throw new NotFoundException('Înregistrarea nu a fost găsită.');

    const data: { name?: string; floorsCount?: number } = {};
    if (payload.name !== undefined) data.name = this.requiredString(payload.name, 'Numele scării este obligatoriu.');
    if (payload.floorsCount !== undefined) data.floorsCount = this.optionalInt(payload.floorsCount, 0);
    if (!Object.keys(data).length) throw new BadRequestException('Nu există date de actualizat.');

    const staircase = await this.prisma.staircase.update({
      where: { id },
      data,
      select: this.staircaseSelect(),
    });
    await this.syncBuildingCounters(existing.buildingId);
    return staircase;
  }

  async importApartments(user: MvpUser, body: unknown, file: Express.Multer.File | undefined, activeOrganizationId?: string) {
    const payload = this.payload(body);
    const organizationId = this.resolveOrganizationId(user, activeOrganizationId, payload);
    this.assertOrganizationAccess(user, organizationId);
    await this.assertOrganizationExists(organizationId);

    if (!file?.buffer?.length) {
      throw new BadRequestException('Fișierul este obligatoriu.');
    }

    const rows = this.parseImportFile(file.buffer);
    if (!rows.length) {
      throw new BadRequestException('Fișierul nu conține rânduri de import.');
    }
    if (!this.hasRequiredApartmentImportColumns(rows[0])) {
      throw new BadRequestException('Fișierul nu conține coloanele necesare.');
    }

    const defaultBuilding = await this.resolveImportBuilding(organizationId, this.optionalString(payload.buildingId));
    const summary = {
      totalRows: rows.length,
      createdApartments: 0,
      skippedApartments: 0,
      createdResidents: 0,
      linkedResidents: 0,
      createdStaircases: 0,
      errors: [] as Array<{ row: number; message: string; messages: string[] }>,
    };

    for (let index = 0; index < rows.length; index += 1) {
      const rowNumber = index + 2;
      const row = rows[index];
      const parsed = this.parseApartmentImportRow(row);
      if (parsed.errors.length) {
        summary.errors.push({ row: rowNumber, message: parsed.errors.join(' '), messages: parsed.errors });
        continue;
      }

      try {
        const building = parsed.buildingName
          ? await this.findOrCreateImportBuilding(organizationId, parsed.buildingName, defaultBuilding.address || undefined)
          : defaultBuilding;
        const { staircase, created } = await this.findOrCreateImportStaircase(organizationId, building.id, parsed.staircase, parsed.floor);
        if (created) summary.createdStaircases += 1;

        let apartment = await this.prisma.apartment.findUnique({
          where: {
            staircaseId_number: {
              staircaseId: staircase.id,
              number: parsed.apartmentNumber,
            },
          },
          select: { id: true, ownerResidentId: true },
        });

        if (apartment) {
          summary.skippedApartments += 1;
        } else {
          apartment = await this.prisma.apartment.create({
            data: {
              organizationId,
              buildingId: building.id,
              staircaseId: staircase.id,
              number: parsed.apartmentNumber,
              floor: parsed.floor,
              areaM2: parsed.areaM2,
              rooms: parsed.rooms,
              status: ApartmentStatus.ACTIVE,
            },
            select: { id: true, ownerResidentId: true },
          });
          summary.createdApartments += 1;
        }

        const hasOwnerData = Boolean(parsed.ownerFirstName || parsed.ownerLastName || parsed.phone || parsed.email);
        if (hasOwnerData) {
          const residentResult = await this.findOrCreateImportResident(organizationId, apartment.id, parsed);
          if (residentResult.created) summary.createdResidents += 1;
          if (residentResult.linked) summary.linkedResidents += 1;
          if (!apartment.ownerResidentId) {
            await this.prisma.apartment.update({
              where: { id: apartment.id },
              data: { ownerResidentId: residentResult.residentId },
            });
          }
        }
      } catch (error) {
        summary.errors.push({
          row: rowNumber,
          message: error instanceof Error ? error.message : 'Nu am putut procesa rândul.',
          messages: [error instanceof Error ? error.message : 'Nu am putut procesa rândul.'],
        });
      }
    }

    return {
      ...summary,
      message: 'Importul a fost finalizat.',
    };
  }

  async getAdminOnboarding(user: MvpUser, activeOrganizationId?: string) {
    const organizationId = this.resolveOrganizationId(user, activeOrganizationId);
    this.assertOrganizationAccess(user, organizationId);

    const [organization, buildingsCount, staircasesCount, apartmentsCount, residentsCount, metersCount, settings, invoicesCount] =
      await Promise.all([
        this.prisma.organization.findUnique({
          where: { id: organizationId },
          select: {
            id: true,
            name: true,
            legalName: true,
            fiscalCode: true,
            address: true,
            city: true,
            country: true,
            currency: true,
            onboardingStatus: true,
            onboardingStep: true,
            onboardingCompletedAt: true,
          },
        }),
        this.prisma.building.count({ where: { organizationId } }),
        this.prisma.staircase.count({ where: { organizationId } }),
        this.prisma.apartment.count({ where: { organizationId } }),
        this.prisma.residentProfile.count({ where: { organizationId } }),
        this.prisma.meter.count({ where: { organizationId } }),
        this.prisma.organizationSetting.findUnique({
          where: { organizationId },
          select: {
            maintenanceFeePerM2: true,
            repairFundPerM2: true,
            developmentFundFixed: true,
          },
        }),
        this.prisma.invoice.count({ where: { organizationId } }),
      ]);

    if (!organization) throw new NotFoundException('Înregistrarea nu a fost găsită.');

    const checklist = {
      organizationDetails: Boolean(organization.name && organization.address && organization.city),
      buildingsCreated: buildingsCount > 0,
      staircasesCreated: staircasesCount > 0,
      apartmentsCreated: apartmentsCount > 0,
      apartmentsImported: apartmentsCount > 0,
      residentsImported: residentsCount > 0,
      metersCreated: metersCount > 0,
      tariffsConfigured: Boolean(
        Number(settings?.maintenanceFeePerM2 || 0) > 0 ||
          Number(settings?.repairFundPerM2 || 0) > 0 ||
          Number(settings?.developmentFundFixed || 0) > 0,
      ),
      invoicesGenerated: invoicesCount > 0,
      firstInvoicesGenerated: invoicesCount > 0,
      paymentProviderConfigured: false,
    };

    const steps = [
      {
        key: 'ORGANIZATION_DETAILS',
        title: 'Date asociație',
        completed: checklist.organizationDetails,
        href: '/admin/settings/organization',
        actionLabel: 'Verifică datele asociației',
      },
      {
        key: 'ADD_FIRST_BUILDING',
        title: 'Clădire / bloc',
        completed: checklist.buildingsCreated,
        href: '/admin/buildings',
        actionLabel: 'Adaugă primul bloc',
      },
      {
        key: 'ADD_STAIRCASES',
        title: 'Scări',
        completed: checklist.staircasesCreated,
        href: '/admin/staircases',
        actionLabel: 'Creează scările',
      },
      {
        key: 'ADD_APARTMENTS',
        title: 'Apartamente',
        completed: checklist.apartmentsCreated,
        href: '/admin/apartments',
        actionLabel: 'Adaugă apartamente',
      },
      {
        key: 'ADD_RESIDENTS',
        title: 'Locatari',
        completed: checklist.residentsImported,
        href: '/admin/residents',
        actionLabel: 'Adaugă locatari',
      },
      {
        key: 'ADD_METERS',
        title: 'Contoare',
        completed: checklist.metersCreated,
        href: '/admin/meters',
        actionLabel: 'Adaugă contoare',
      },
      {
        key: 'CONFIGURE_TARIFFS',
        title: 'Tarife',
        completed: checklist.tariffsConfigured,
        href: '/admin/tariffs',
        actionLabel: 'Configurează tarifele',
      },
      {
        key: 'GENERATE_FIRST_INVOICES',
        title: 'Facturi',
        completed: checklist.invoicesGenerated,
        href: '/admin/invoices',
        actionLabel: 'Generează facturi',
      },
    ];
    const completed = steps.filter((step) => step.completed).length;
    const nextStep = steps.find((step) => !step.completed) ?? steps[steps.length - 1];
    const percent = Math.round((completed / steps.length) * 100);

    return {
      organization: {
        ...organization,
        shortName: organization.name,
        associationCode: organization.fiscalCode,
        onboardingStatus: completed === steps.length ? OnboardingStatus.COMPLETED : organization.onboardingStatus,
        onboardingStep: nextStep.key,
      },
      checklist,
      steps,
      counts: {
        buildings: buildingsCount,
        staircases: staircasesCount,
        apartments: apartmentsCount,
        residents: residentsCount,
        meters: metersCount,
        invoices: invoicesCount,
      },
      progress: percent,
      progressDetails: {
        completed,
        total: steps.length,
        percent,
        label: `Configurare inițială: ${completed}/${steps.length} pași completați`,
      },
      nextStep,
    };
  }

  async updateAdminOnboarding(user: MvpUser, body: unknown, activeOrganizationId?: string) {
    const payload = this.payload(body);
    const organizationId = this.resolveOrganizationId(user, activeOrganizationId, payload);
    this.assertOrganizationAccess(user, organizationId);
    await this.assertOrganizationExists(organizationId);

    const onboardingStatus = this.optionalString(payload.onboardingStatus);
    const onboardingStep = this.optionalString(payload.onboardingStep);
    if (onboardingStatus && !Object.values(OnboardingStatus).includes(onboardingStatus as OnboardingStatus)) {
      throw new BadRequestException('Statusul de configurare nu este valid.');
    }

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        ...(onboardingStatus ? { onboardingStatus: onboardingStatus as OnboardingStatus } : {}),
        ...(onboardingStep ? { onboardingStep } : {}),
      },
    });

    return this.getAdminOnboarding(user, activeOrganizationId);
  }

  async completeAdminOnboarding(user: MvpUser, activeOrganizationId?: string) {
    const organizationId = this.resolveOrganizationId(user, activeOrganizationId);
    this.assertOrganizationAccess(user, organizationId);
    await this.assertOrganizationExists(organizationId);

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        onboardingCompleted: true,
        onboardingStatus: OnboardingStatus.COMPLETED,
        onboardingStep: 'FINISH_SETUP',
        onboardingCompletedAt: new Date(),
      },
    });

    return this.getAdminOnboarding(user, activeOrganizationId);
  }

  private async assertBuildingInOrganization(buildingId: string, organizationId: string) {
    const building = await this.prisma.building.findFirst({
      where: { id: buildingId, organizationId },
      select: { id: true },
    });
    if (!building) throw new NotFoundException('Înregistrarea nu a fost găsită.');
  }

  private parseImportFile(fileBuffer: Buffer) {
    try {
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const firstSheet = workbook.SheetNames[0];
      if (!firstSheet) return [];
      const sheet = workbook.Sheets[firstSheet];
      return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
    } catch {
      throw new BadRequestException('Nu am putut procesa fișierul.');
    }
  }

  private normalizeColumnName(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private readImportValue(row: Record<string, unknown>, aliases: string[]) {
    const normalized = new Map<string, unknown>();
    Object.entries(row).forEach(([key, value]) => {
      normalized.set(this.normalizeColumnName(key), value);
    });
    for (const alias of aliases) {
      const value = normalized.get(this.normalizeColumnName(alias));
      if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
    }
    return '';
  }

  private hasImportColumn(row: Record<string, unknown>, aliases: string[]) {
    const columns = new Set(Object.keys(row).map((key) => this.normalizeColumnName(key)));
    return aliases.some((alias) => columns.has(this.normalizeColumnName(alias)));
  }

  private hasRequiredApartmentImportColumns(row: Record<string, unknown>) {
    return (
      this.hasImportColumn(row, ['scara', 'scară', 'staircase', 'staircaseName']) &&
      this.hasImportColumn(row, ['apartament', 'apartment', 'apartmentNumber', 'numar_apartament']) &&
      this.hasImportColumn(row, ['etaj', 'floor']) &&
      this.hasImportColumn(row, ['suprafata_m2', 'suprafata', 'suprafață m²', 'areaM2', 'area_m2'])
    );
  }

  private parseApartmentImportRow(row: Record<string, unknown>) {
    const staircase = this.readImportValue(row, ['scara', 'scară', 'staircase', 'staircaseName']);
    const rawApartment = this.readImportValue(row, ['apartament', 'apartment', 'apartmentNumber', 'numar_apartament']);
    const apartmentNumber = rawApartment.replace(/^(apt\.?|apartament)\s*/i, '').trim();
    const rawFloor = this.readImportValue(row, ['etaj', 'floor']);
    const rawArea = this.readImportValue(row, ['suprafata_m2', 'suprafata', 'suprafață m²', 'areaM2', 'area_m2']);
    const rawRooms = this.readImportValue(row, ['camere', 'rooms']);
    const email = this.readImportValue(row, ['email', 'owner_email', 'proprietar_email']).toLowerCase();
    const parsed = {
      buildingName: this.readImportValue(row, ['bloc', 'building', 'buildingName']),
      staircase,
      apartmentNumber,
      floor: Number(rawFloor),
      areaM2: Number(String(rawArea).replace(',', '.')),
      rooms: rawRooms ? Number(rawRooms) : 1,
      ownerFirstName: this.readImportValue(row, ['proprietar_prenume', 'prenume', 'owner_first_name']),
      ownerLastName: this.readImportValue(row, ['proprietar_nume', 'nume', 'owner_last_name']),
      phone: this.readImportValue(row, ['telefon', 'phone']),
      email,
      errors: [] as string[],
    };

    if (!parsed.staircase) parsed.errors.push('Scara este obligatorie.');
    if (!parsed.apartmentNumber) parsed.errors.push('Numărul apartamentului este obligatoriu.');
    if (!rawFloor || !Number.isFinite(parsed.floor)) parsed.errors.push('Etajul trebuie să fie un număr.');
    if (!rawArea || !Number.isFinite(parsed.areaM2)) parsed.errors.push('Suprafața trebuie să fie un număr.');
    if (rawRooms && (!Number.isFinite(parsed.rooms) || parsed.rooms < 1)) parsed.errors.push('Numărul de camere trebuie să fie un număr.');
    if (parsed.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parsed.email)) parsed.errors.push('Emailul proprietarului nu este valid.');

    return parsed;
  }

  private async resolveImportBuilding(organizationId: string, buildingId?: string) {
    if (buildingId) {
      const building = await this.prisma.building.findFirst({
        where: { id: buildingId, organizationId },
        select: { id: true, name: true, address: true },
      });
      if (!building) throw new NotFoundException('Blocul nu a fost găsit.');
      return building;
    }

    const existing = await this.prisma.building.findFirst({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, address: true },
    });
    if (existing) return existing;

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { address: true },
    });
    return this.prisma.building.create({
      data: {
        organizationId,
        name: 'Bloc principal',
        address: organization?.address || null,
      },
      select: { id: true, name: true, address: true },
    });
  }

  private async findOrCreateImportBuilding(organizationId: string, name: string, fallbackAddress?: string) {
    const existing = await this.prisma.building.findFirst({
      where: { organizationId, name },
      select: { id: true, name: true, address: true },
    });
    if (existing) return existing;
    return this.prisma.building.create({
      data: {
        organizationId,
        name,
        address: fallbackAddress || null,
      },
      select: { id: true, name: true, address: true },
    });
  }

  private async findOrCreateImportStaircase(organizationId: string, buildingId: string, name: string, floorHint: number) {
    const existing = await this.prisma.staircase.findFirst({
      where: { organizationId, buildingId, name },
      select: { id: true, name: true, floorsCount: true },
    });
    if (existing) return { staircase: existing, created: false };

    const staircase = await this.prisma.staircase.create({
      data: {
        organizationId,
        buildingId,
        name,
        floorsCount: Math.max(Math.round(floorHint || 0), 0),
      },
      select: { id: true, name: true, floorsCount: true },
    });
    await this.syncBuildingCounters(buildingId);
    return { staircase, created: true };
  }

  private async findOrCreateImportResident(
    organizationId: string,
    apartmentId: string,
    parsed: {
      ownerFirstName: string;
      ownerLastName: string;
      phone: string;
      email: string;
    },
  ) {
    const firstName = parsed.ownerFirstName || (parsed.ownerLastName ? '' : 'Proprietar');
    const lastName = parsed.ownerLastName || '';
    const existing = await this.prisma.residentProfile.findFirst({
      where: {
        organizationId,
        OR: [
          ...(parsed.email ? [{ email: parsed.email }] : []),
          ...(parsed.phone ? [{ phone: parsed.phone, firstName, lastName }] : []),
          { apartmentId, firstName, lastName, type: ResidentType.OWNER },
        ],
      },
      select: { id: true },
    });

    const resident = existing
      ? existing
      : await this.prisma.residentProfile.create({
          data: {
            organizationId,
            apartmentId,
            firstName,
            lastName,
            phone: parsed.phone || null,
            email: parsed.email || null,
            accountStatus: ResidentAccountStatus.NO_ACCOUNT,
            type: ResidentType.OWNER,
            isPrimary: true,
          },
          select: { id: true },
        });

    const relation = await this.prisma.apartmentResident.findFirst({
      where: {
        apartmentId,
        residentId: resident.id,
        role: ApartmentResidentRole.OWNER,
      },
      select: { apartmentId: true },
    });
    if (!relation) {
      await this.prisma.apartmentResident.updateMany({
        where: { apartmentId, isPrimary: true },
        data: { isPrimary: false },
      });
      await this.prisma.apartmentResident.create({
        data: {
          apartmentId,
          residentId: resident.id,
          role: ApartmentResidentRole.OWNER,
          isPrimary: true,
        },
      });
    }

    return {
      residentId: resident.id,
      created: !existing,
      linked: !relation,
    };
  }

  private async syncBuildingCounters(buildingId: string) {
    const [staircasesCount, apartmentsCount] = await Promise.all([
      this.prisma.staircase.count({ where: { buildingId } }),
      this.prisma.apartment.count({ where: { buildingId } }),
    ]);
    await this.prisma.building.update({
      where: { id: buildingId },
      data: { staircasesCount, apartmentsCount },
    });
  }

  private payload(body: unknown) {
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  }

  private requiredString(value: unknown, message: string) {
    if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(message);
    return value.trim();
  }

  private optionalString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : '';
  }

  private optionalInt(value: unknown, fallback: number) {
    if (value === undefined || value === null || value === '') return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) throw new BadRequestException('Valoarea numerică nu este validă.');
    return Math.round(parsed);
  }
}
