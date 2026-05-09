import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ApartmentResidentRole,
  ApartmentStatus,
  BillingCurrency,
  OnboardingStatus,
  OrganizationStatus,
  ResidentAccountStatus,
  ResidentType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { MvpUser } from '../security/mvp-auth.guard';

type WizardStatus = 'DRAFT' | 'ACTIVE';
type OnboardingMetadata = {
  constructionYear?: string;
  apartments?: Record<string, { cadastralNumber?: string }>;
  residents?: Record<string, { preferredContactMethod?: string }>;
  otherFixedServices?: Array<{ name: string; amount: number }>;
};

@Injectable()
export class AssociationOnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async start(user: MvpUser, body: unknown) {
    const input = this.parseStepOne(body);
    await this.assertUniqueAssociation(input.associationCode, input.legalName);

    const organization = await this.prisma.organization.create({
      data: {
        name: input.shortName,
        legalName: input.legalName,
        fiscalCode: input.associationCode,
        address: input.address,
        city: input.city,
        country: input.country,
        currency: BillingCurrency.MDL,
        defaultCurrency: BillingCurrency.MDL,
        status: OrganizationStatus.TRIAL,
        onboardingStatus: OnboardingStatus.IN_PROGRESS,
        onboardingStep: 'step-1',
        createdByAgentId: user.id,
      },
      select: { id: true },
    });

    await this.prisma.onboardingChecklist.upsert({
      where: { organizationId: organization.id },
      update: {},
      create: { organizationId: organization.id },
    });

    await this.upsertInternalNote(organization.id, user.id, 'IDNO onboarding', input.idno);

    return this.getState(user, organization.id);
  }

  async getState(_user: MvpUser, id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        legalName: true,
        fiscalCode: true,
        address: true,
        city: true,
        country: true,
        currency: true,
        status: true,
        onboardingStatus: true,
        onboardingStep: true,
        onboardingCompleted: true,
        onboardingCompletedAt: true,
      },
    });
    if (!organization) throw new NotFoundException('Înregistrarea nu a fost găsită.');

    const [buildings, apartments, residentLinks, settings, checklist, structureNote, idnoNote, metadata] = await Promise.all([
      this.prisma.building.findMany({
        where: { organizationId: id },
        orderBy: [{ name: 'asc' }],
        select: {
          id: true,
          name: true,
          address: true,
          totalFloors: true,
          staircasesCount: true,
          apartmentsCount: true,
          staircases: {
            orderBy: [{ name: 'asc' }],
            select: {
              id: true,
              name: true,
              floorsCount: true,
            },
          },
        },
      }),
      this.prisma.apartment.findMany({
        where: { organizationId: id },
        orderBy: [{ staircase: { name: 'asc' } }, { floor: 'asc' }, { number: 'asc' }],
        select: {
          id: true,
          number: true,
          floor: true,
          areaM2: true,
          rooms: true,
          status: true,
          building: { select: { id: true, name: true } },
          staircase: { select: { id: true, name: true } },
        },
      }),
      this.prisma.apartmentResident.findMany({
        where: {
          apartment: { organizationId: id },
        },
        orderBy: [{ apartment: { number: 'asc' } }, { createdAt: 'asc' }],
        select: {
          role: true,
          isPrimary: true,
          resident: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
              accountStatus: true,
            },
          },
          apartment: {
            select: {
              id: true,
              number: true,
              building: { select: { id: true, name: true } },
              staircase: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.prisma.organizationSetting.findUnique({
        where: { organizationId: id },
        select: {
          maintenanceFeePerM2: true,
          repairFundPerM2: true,
          developmentFundFixed: true,
        },
      }),
      this.prisma.onboardingChecklist.findUnique({
        where: { organizationId: id },
      }),
      this.findInternalNote(id, 'Structură onboarding'),
      this.findInternalNote(id, 'IDNO onboarding'),
      this.readOnboardingMetadata(id),
    ]);

    const totalAreaM2 = apartments.reduce((sum, apartment) => sum + Number(apartment.areaM2 || 0), 0);
    const wizardStatus: WizardStatus =
      organization.status === OrganizationStatus.ACTIVE && organization.onboardingStatus === OnboardingStatus.COMPLETED
        ? 'ACTIVE'
        : 'DRAFT';

    return {
      id: organization.id,
      status: wizardStatus,
      onboardingStatus: organization.onboardingStatus,
      onboardingStep: organization.onboardingStep || 'step-1',
      association: {
        id: organization.id,
        legalName: organization.legalName || this.legalNameForCode(organization.fiscalCode || ''),
        shortName: organization.name,
        associationCode: organization.fiscalCode || '',
        internalNumber: this.associationNumberFromCode(organization.fiscalCode || ''),
        fiscalCode: idnoNote?.content || '',
        address: organization.address || '',
        city: organization.city || 'Chișinău',
        country: this.normalizeCountryLabel(organization.country || 'Republica Moldova'),
        currency: organization.currency,
        status: wizardStatus,
      },
      structure: {
        buildingsCount: buildings.length || 1,
        staircasesCount: buildings.reduce((sum, building) => sum + building.staircases.length, 0),
        floorsCount: Math.max(0, ...buildings.flatMap((building) => building.staircases.map((staircase) => staircase.floorsCount || 0))),
        apartmentsCount: apartments.length || buildings.reduce((sum, building) => sum + Number(building.apartmentsCount || 0), 0),
        constructionYear: metadata.constructionYear || '',
        internalNotes: structureNote?.content || '',
      },
      buildings,
      apartments: apartments.map((apartment) => ({
        id: apartment.id,
        apartmentNumber: apartment.number,
        buildingId: apartment.building.id,
        building: apartment.building.name,
        staircaseId: apartment.staircase.id,
        entrance: apartment.staircase.name,
        floor: apartment.floor,
        areaM2: apartment.areaM2,
        rooms: apartment.rooms,
        cadastralNumber: metadata.apartments?.[apartment.id]?.cadastralNumber || '',
        status: this.toWizardApartmentStatus(apartment.status),
      })),
      residents: residentLinks.map((link) => ({
        residentId: link.resident.id,
        apartmentId: link.apartment.id,
        apartmentNumber: link.apartment.number,
        building: link.apartment.building.name,
        entrance: link.apartment.staircase.name,
        fullName: this.fullName(link.resident),
        phone: link.resident.phone || '',
        email: link.resident.email || '',
        role: this.toWizardResidentRole(link.role),
        isPrimaryContact: link.isPrimary,
        preferredContactMethod: metadata.residents?.[`${link.apartment.id}:${link.resident.id}:${link.role}`]?.preferredContactMethod || 'PHONE',
        status: this.toWizardResidentStatus(link.resident.accountStatus),
      })),
      tariffs: {
        deservireBlocPerM2: Number(settings?.maintenanceFeePerM2 || 0) || 2.85,
        fondReparatiePerM2: Number(settings?.repairFundPerM2 || 0) || 0.5,
        fondInvestitiiPerApartment: Number(settings?.developmentFundFixed || 0) || 60,
        otherFixedServices: metadata.otherFixedServices || [],
      },
      checklist,
      summary: {
        associationName: organization.name,
        associationCode: organization.fiscalCode || '',
        address: organization.address || '',
        totalStaircases: buildings.reduce((sum, building) => sum + building.staircases.length, 0),
        totalApartments: apartments.length,
        totalAreaM2: this.money(totalAreaM2),
        totalResidents: residentLinks.length,
        tariffsConfigured: Boolean(
          settings &&
            (Number(settings.maintenanceFeePerM2 || 0) > 0 ||
              Number(settings.repairFundPerM2 || 0) > 0 ||
              Number(settings.developmentFundFixed || 0) > 0),
        ),
        onboardingStatus: organization.onboardingStatus,
      },
      redirectPath: `/ro/superadmin/associations/${organization.id}`,
    };
  }

  async updateStepOne(user: MvpUser, id: string, body: unknown) {
    await this.ensureDraftOrganization(id);
    const input = this.parseStepOne(body);
    await this.assertUniqueAssociation(input.associationCode, input.legalName, id);

    await this.prisma.organization.update({
      where: { id },
      data: {
        name: input.shortName,
        legalName: input.legalName,
        fiscalCode: input.associationCode,
        address: input.address,
        city: input.city,
        country: input.country,
        currency: BillingCurrency.MDL,
        defaultCurrency: BillingCurrency.MDL,
        status: OrganizationStatus.TRIAL,
        onboardingStatus: OnboardingStatus.IN_PROGRESS,
        onboardingStep: 'step-1',
      },
    });

    await this.upsertInternalNote(id, user.id, 'IDNO onboarding', input.idno);
    return this.getState(user, id);
  }

  async updateStepTwo(user: MvpUser, id: string, body: unknown) {
    const organization = await this.ensureDraftOrganization(id);
    const input = this.parseStepTwo(body);

    const buildingIds: string[] = [];
    let staircaseIndex = 1;
    for (let buildingIndex = 1; buildingIndex <= input.buildingsCount; buildingIndex += 1) {
      const buildingName = input.buildingsCount === 1 ? 'Bloc principal' : `Bloc ${buildingIndex}`;
      const staircasesForBuilding = this.distributeCount(input.staircasesCount, input.buildingsCount, buildingIndex);
      const apartmentsForBuilding = this.distributeCount(input.apartmentsCount, input.buildingsCount, buildingIndex);
      const building = await this.upsertBuilding(id, buildingName, organization.address || '', input.floorsCount, staircasesForBuilding, apartmentsForBuilding);
      buildingIds.push(building.id);

      for (let offset = 0; offset < staircasesForBuilding; offset += 1) {
        await this.upsertStaircase(id, building.id, String(staircaseIndex), input.floorsCount);
        staircaseIndex += 1;
      }
    }

    await Promise.all(buildingIds.map((buildingId) => this.syncBuildingCounters(buildingId)));
    await this.upsertInternalNote(id, user.id, 'Structură onboarding', input.internalNotes);
    await this.updateOnboardingMetadata(id, user.id, { constructionYear: input.constructionYear ? String(input.constructionYear) : '' });
    await this.prisma.organization.update({
      where: { id },
      data: { onboardingStatus: OnboardingStatus.IN_PROGRESS, onboardingStep: 'step-2' },
    });
    await this.prisma.onboardingChecklist.upsert({
      where: { organizationId: id },
      update: { buildingsCreated: true },
      create: { organizationId: id, buildingsCreated: true },
    });

    return this.getState(user, id);
  }

  async updateApartments(user: MvpUser, id: string, body: unknown) {
    await this.ensureDraftOrganization(id);
    const rows = this.parseApartments(body);
    const seen = new Set<string>();
    const touchedBuildingIds = new Set<string>();

    const metadataPatch: OnboardingMetadata = { apartments: {} };
    for (const row of rows) {
      const building = await this.findOrCreateBuildingByName(id, row.building);
      const staircase = await this.findOrCreateStaircaseByName(id, building.id, row.entrance, row.floor || 0);
      const key = `${building.id}:${staircase.id}:${row.apartmentNumber.toLowerCase()}`;
      if (seen.has(key)) throw new BadRequestException('Apartamentele nu trebuie să aibă numere duplicate în aceeași asociație.');
      seen.add(key);

      const data = {
        organizationId: id,
        buildingId: building.id,
        staircaseId: staircase.id,
        number: row.apartmentNumber,
        floor: row.floor,
        areaM2: row.areaM2,
        rooms: row.rooms,
        status: row.status,
      };

      let savedApartmentId = row.id;
      if (row.id) {
        const existing = await this.prisma.apartment.findFirst({
          where: { id: row.id, organizationId: id },
          select: { id: true },
        });
        if (!existing) throw new NotFoundException('Înregistrarea nu a fost găsită.');
        await this.prisma.apartment.update({ where: { id: row.id }, data });
      } else {
        const existing = await this.prisma.apartment.findUnique({
          where: { staircaseId_number: { staircaseId: staircase.id, number: row.apartmentNumber } },
          select: { id: true },
        });
        if (existing) {
          await this.prisma.apartment.update({ where: { id: existing.id }, data });
          savedApartmentId = existing.id;
        } else {
          const created = await this.prisma.apartment.create({ data, select: { id: true } });
          savedApartmentId = created.id;
        }
      }
      if (savedApartmentId) {
        metadataPatch.apartments![savedApartmentId] = { cadastralNumber: row.cadastralNumber };
      }
      touchedBuildingIds.add(building.id);
    }

    await this.updateOnboardingMetadata(id, user.id, metadataPatch);
    await Promise.all(Array.from(touchedBuildingIds).map((buildingId) => this.syncBuildingCounters(buildingId)));
    await this.prisma.organization.update({
      where: { id },
      data: { onboardingStatus: OnboardingStatus.IN_PROGRESS, onboardingStep: 'apartments' },
    });
    await this.prisma.onboardingChecklist.upsert({
      where: { organizationId: id },
      update: { apartmentsImported: rows.length > 0 },
      create: { organizationId: id, apartmentsImported: rows.length > 0 },
    });

    return this.getState(user, id);
  }

  async updateResidents(user: MvpUser, id: string, body: unknown) {
    await this.ensureDraftOrganization(id);
    const rows = this.parseResidents(body);

    const metadataPatch: OnboardingMetadata = { residents: {} };
    for (const row of rows) {
      const apartment = await this.findApartmentForResident(id, row);
      const resident = await this.findOrCreateResident(id, apartment.id, row);
      const relation = await this.prisma.apartmentResident.findFirst({
        where: {
          apartmentId: apartment.id,
          residentId: resident.id,
          role: row.role,
        },
        select: { apartmentId: true, residentId: true, role: true },
      });

      if (row.isPrimaryContact) {
        await this.prisma.apartmentResident.updateMany({
          where: { apartmentId: apartment.id, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      if (relation) {
        await this.prisma.apartmentResident.update({
          where: {
            apartmentId_residentId_role: {
              apartmentId: apartment.id,
              residentId: resident.id,
              role: row.role,
            },
          },
          data: { isPrimary: row.isPrimaryContact },
        });
      } else {
        await this.prisma.apartmentResident.create({
          data: {
            apartmentId: apartment.id,
            residentId: resident.id,
            role: row.role,
            isPrimary: row.isPrimaryContact,
          },
        });
      }

      if (row.role === ApartmentResidentRole.OWNER && row.isPrimaryContact) {
        await this.prisma.apartment.update({
          where: { id: apartment.id },
          data: { ownerResidentId: resident.id, status: ApartmentStatus.OCCUPIED },
        });
      }
      metadataPatch.residents![`${apartment.id}:${resident.id}:${row.role}`] = {
        preferredContactMethod: row.preferredContactMethod,
      };
    }

    await this.updateOnboardingMetadata(id, user.id, metadataPatch);
    await this.prisma.organization.update({
      where: { id },
      data: { onboardingStatus: OnboardingStatus.IN_PROGRESS, onboardingStep: 'residents' },
    });
    await this.prisma.onboardingChecklist.upsert({
      where: { organizationId: id },
      update: { residentsImported: rows.length > 0 },
      create: { organizationId: id, residentsImported: rows.length > 0 },
    });

    return this.getState(user, id);
  }

  async updateTariffs(user: MvpUser, id: string, body: unknown) {
    await this.ensureDraftOrganization(id);
    const input = this.parseTariffs(body);
    const payload = this.payload(body);

    await this.prisma.organizationSetting.upsert({
      where: { organizationId: id },
      update: {
        maintenanceFeePerM2: input.deservireBlocPerM2,
        repairFundPerM2: input.fondReparatiePerM2,
        developmentFundFixed: input.fondInvestitiiPerApartment,
      },
      create: {
        organizationId: id,
        maintenanceFeePerM2: input.deservireBlocPerM2,
        repairFundPerM2: input.fondReparatiePerM2,
        developmentFundFixed: input.fondInvestitiiPerApartment,
        appName: 'Espace',
        defaultLocale: 'ro',
        weekStart: 'MONDAY',
      },
    });
    await this.updateOnboardingMetadata(id, user.id, {
      otherFixedServices: Array.isArray(payload.otherFixedServices) ? payload.otherFixedServices : [],
    });

    await this.prisma.organization.update({
      where: { id },
      data: { onboardingStatus: OnboardingStatus.IN_PROGRESS, onboardingStep: 'tariffs' },
    });
    await this.prisma.onboardingChecklist.upsert({
      where: { organizationId: id },
      update: { tariffsConfigured: true },
      create: { organizationId: id, tariffsConfigured: true },
    });

    return this.getState(user, id);
  }

  async activate(user: MvpUser, id: string) {
    const state = await this.getState(user, id);
    if (!state.association.legalName || !state.association.shortName || !state.association.associationCode || !state.association.address) {
      throw new BadRequestException('Completează datele A.P.C. înainte de activare.');
    }
    if (state.summary.totalApartments <= 0) {
      throw new BadRequestException('Total apartamente trebuie să fie mai mare decât 0.');
    }
    if (!state.summary.tariffsConfigured) {
      throw new BadRequestException('Configurează tarifele inițiale înainte de activare.');
    }

    await this.prisma.organization.update({
      where: { id },
      data: {
        status: OrganizationStatus.ACTIVE,
        onboardingStatus: OnboardingStatus.COMPLETED,
        onboardingStep: 'completed',
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(),
      },
    });
    await this.prisma.onboardingChecklist.upsert({
      where: { organizationId: id },
      update: {
        buildingsCreated: state.summary.totalStaircases > 0,
        apartmentsImported: state.summary.totalApartments > 0,
        residentsImported: state.summary.totalResidents > 0,
        tariffsConfigured: true,
      },
      create: {
        organizationId: id,
        buildingsCreated: state.summary.totalStaircases > 0,
        apartmentsImported: state.summary.totalApartments > 0,
        residentsImported: state.summary.totalResidents > 0,
        tariffsConfigured: true,
      },
    });

    return {
      ...(await this.getState(user, id)),
      message: 'Asociația a fost activată.',
      redirectPath: `/ro/superadmin/associations/${id}`,
    };
  }

  private parseStepOne(body: unknown) {
    const payload = this.payload(body);
    const associationCode = this.requiredString(payload.associationCode, 'Codul A.P.C. este obligatoriu.').toUpperCase();
    if (!/^A\d{4}-\d{4}$/.test(associationCode)) {
      throw new BadRequestException('Format recomandat: A0123-0940.');
    }
    const legalName = this.requiredString(payload.legalName, 'Denumirea asociației este obligatorie.');
    const shortName = this.requiredString(payload.shortName, 'Denumirea scurtă este obligatorie.');
    const address = this.requiredString(payload.address, 'Adresa este obligatorie.');
    const city = this.optionalString(payload.city) || 'Chișinău';
    return {
      associationCode,
      legalName,
      shortName,
      internalNumber: this.optionalString(payload.internalNumber) || this.associationNumberFromCode(associationCode),
      idno: this.optionalString(payload.fiscalCode ?? payload.idno),
      address,
      city,
      country: this.normalizeCountryLabel(this.optionalString(payload.country) || 'Republica Moldova'),
      status: this.optionalString(payload.status) === 'ACTIVE' ? 'ACTIVE' : 'DRAFT',
    };
  }

  private parseStepTwo(body: unknown) {
    const payload = this.payload(body);
    const buildingsCount = this.positiveInt(payload.buildingsCount ?? payload.blocksCount, 'Numărul de blocuri trebuie să fie pozitiv.');
    const staircasesCount = this.positiveInt(payload.staircasesCount, 'Numărul de scări trebuie să fie pozitiv.');
    const floorsCount = this.positiveInt(payload.floorsCount, 'Numărul de etaje trebuie să fie pozitiv.');
    const apartmentsCount = this.positiveInt(payload.apartmentsCount, 'Total apartamente trebuie să fie mai mare decât 0.');
    return {
      buildingsCount,
      staircasesCount,
      floorsCount,
      apartmentsCount,
      constructionYear: this.optionalInt(payload.constructionYear),
      internalNotes: this.optionalString(payload.internalNotes),
    };
  }

  private parseApartments(body: unknown) {
    const payload = this.payload(body);
    const rows = Array.isArray(payload.apartments) ? payload.apartments : [];
    if (!rows.length) throw new BadRequestException('Adaugă cel puțin un apartament.');
    return rows.map((item) => {
      const row = this.payload(item);
      const areaRaw = row.areaM2;
      const areaM2 = areaRaw === undefined || areaRaw === null || areaRaw === '' ? null : Number(areaRaw);
      if (areaM2 !== null && (!Number.isFinite(areaM2) || areaM2 <= 0)) {
        throw new BadRequestException('Suprafața m² trebuie să fie pozitivă dacă este introdusă.');
      }
      return {
        id: this.optionalString(row.id),
        apartmentNumber: this.requiredString(row.apartmentNumber ?? row.number, 'Numărul apartamentului este obligatoriu.'),
        building: this.optionalString(row.building ?? row.block) || 'Bloc principal',
        entrance: this.requiredString(row.entrance ?? row.staircase ?? row.scara, 'Scara este obligatorie.'),
        floor: this.optionalInt(row.floor),
        areaM2,
        rooms: this.optionalInt(row.rooms),
        cadastralNumber: this.optionalString(row.cadastralNumber),
        status: this.parseApartmentStatus(row.status),
      };
    });
  }

  private parseResidents(body: unknown) {
    const payload = this.payload(body);
    const rows = Array.isArray(payload.residents) ? payload.residents : [];
    return rows
      .map((item) => this.payload(item))
      .filter((row) => Object.values(row).some((value) => String(value ?? '').trim()))
      .map((row) => {
        const fullName = this.requiredString(row.fullName, 'Numele locatarului este obligatoriu.');
        const email = this.optionalString(row.email).toLowerCase();
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('Emailul nu este valid.');
        const phone = this.optionalString(row.phone);
        if (phone && !this.isValidMoldovaPhone(phone)) throw new BadRequestException('Telefonul nu este valid.');
        return {
          residentId: this.optionalString(row.residentId),
          apartmentId: this.optionalString(row.apartmentId),
          apartmentNumber: this.optionalString(row.apartmentNumber),
          building: this.optionalString(row.building ?? row.block) || 'Bloc principal',
          entrance: this.optionalString(row.entrance ?? row.staircase ?? row.scara),
          fullName,
          phone: phone ? this.normalizeMoldovaPhone(phone) : '',
          email,
          role: this.parseResidentRole(row.role),
          isPrimaryContact: Boolean(row.isPrimaryContact),
          preferredContactMethod: this.optionalString(row.preferredContactMethod) || 'PHONE',
          status: this.parseResidentStatus(row.status),
        };
      });
  }

  private parseTariffs(body: unknown) {
    const payload = this.payload(body);
    const deservireBlocPerM2 = this.nonNegativeNumber(payload.deservireBlocPerM2, 'Suma pentru deservire bloc trebuie să fie pozitivă.');
    const fondReparatiePerM2 = this.nonNegativeNumber(payload.fondReparatiePerM2, 'Suma pentru fond reparație trebuie să fie pozitivă.');
    const fondInvestitiiPerApartment = this.nonNegativeNumber(payload.fondInvestitiiPerApartment, 'Suma pentru fond investiții trebuie să fie pozitivă.');
    return {
      deservireBlocPerM2,
      fondReparatiePerM2,
      fondInvestitiiPerApartment,
    };
  }

  private async ensureDraftOrganization(id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
      select: { id: true, address: true },
    });
    if (!organization) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    return organization;
  }

  private async assertUniqueAssociation(associationCode: string, legalName: string, exceptId?: string) {
    const duplicate = await this.prisma.organization.findFirst({
      where: {
        ...(exceptId ? { id: { not: exceptId } } : {}),
        OR: [
          { fiscalCode: associationCode },
          { legalName: { equals: legalName, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('Există deja o asociație cu acest cod A.P.C.');
  }

  private async upsertBuilding(organizationId: string, name: string, address: string, totalFloors: number, staircasesCount: number, apartmentsCount: number) {
    const existing = await this.prisma.building.findFirst({
      where: { organizationId, name },
      select: { id: true },
    });
    if (existing) {
      return this.prisma.building.update({
        where: { id: existing.id },
        data: { address, totalFloors, staircasesCount, apartmentsCount },
        select: { id: true },
      });
    }
    return this.prisma.building.create({
      data: { organizationId, name, address, totalFloors, staircasesCount, apartmentsCount },
      select: { id: true },
    });
  }

  private async upsertStaircase(organizationId: string, buildingId: string, name: string, floorsCount: number) {
    const existing = await this.prisma.staircase.findFirst({
      where: { organizationId, buildingId, name },
      select: { id: true },
    });
    if (existing) {
      return this.prisma.staircase.update({
        where: { id: existing.id },
        data: { floorsCount },
        select: { id: true },
      });
    }
    return this.prisma.staircase.create({
      data: { organizationId, buildingId, name, floorsCount },
      select: { id: true },
    });
  }

  private async findOrCreateBuildingByName(organizationId: string, name: string) {
    const existing = await this.prisma.building.findFirst({
      where: { organizationId, name },
      select: { id: true, name: true },
    });
    if (existing) return existing;
    return this.prisma.building.create({
      data: { organizationId, name, address: null },
      select: { id: true, name: true },
    });
  }

  private async findOrCreateStaircaseByName(organizationId: string, buildingId: string, name: string, floorHint: number) {
    const existing = await this.prisma.staircase.findFirst({
      where: { organizationId, buildingId, name },
      select: { id: true, name: true },
    });
    if (existing) return existing;
    return this.prisma.staircase.create({
      data: { organizationId, buildingId, name, floorsCount: Math.max(1, floorHint || 1) },
      select: { id: true, name: true },
    });
  }

  private async findApartmentForResident(
    organizationId: string,
    row: { apartmentId: string; apartmentNumber: string; building: string; entrance: string },
  ) {
    if (row.apartmentId) {
      const byId = await this.prisma.apartment.findFirst({
        where: { id: row.apartmentId, organizationId },
        select: { id: true },
      });
      if (byId) return byId;
    }
    if (!row.apartmentNumber || !row.entrance) throw new BadRequestException('Apartamentul este obligatoriu pentru locatar.');
    const apartment = await this.prisma.apartment.findFirst({
      where: {
        organizationId,
        number: row.apartmentNumber,
        building: { name: row.building },
        staircase: { name: row.entrance },
      },
      select: { id: true },
    });
    if (!apartment) throw new NotFoundException('Apartamentul nu a fost găsit.');
    return apartment;
  }

  private async findOrCreateResident(
    organizationId: string,
    apartmentId: string,
    row: {
      residentId: string;
      fullName: string;
      phone: string;
      email: string;
      role: ApartmentResidentRole;
      isPrimaryContact: boolean;
      status: ResidentAccountStatus;
    },
  ) {
    const name = this.splitFullName(row.fullName);
    let existing: { id: string } | null = null;
    if (row.residentId) {
      existing = await this.prisma.residentProfile.findFirst({
        where: { id: row.residentId, organizationId },
        select: { id: true },
      });
    }
    if (!existing && row.email) {
      existing = await this.prisma.residentProfile.findFirst({ where: { organizationId, email: row.email }, select: { id: true } });
    }
    if (!existing && row.phone) {
      existing = await this.prisma.residentProfile.findFirst({ where: { organizationId, phone: row.phone }, select: { id: true } });
    }
    if (!existing) {
      existing = await this.prisma.residentProfile.findFirst({
        where: { organizationId, firstName: name.firstName, lastName: name.lastName },
        select: { id: true },
      });
    }

    const data = {
      apartmentId,
      firstName: name.firstName,
      lastName: name.lastName,
      phone: row.phone || null,
      email: row.email || null,
      accountStatus: row.status,
      type: this.toResidentType(row.role),
      isPrimary: row.isPrimaryContact,
    };

    if (existing) {
      return this.prisma.residentProfile.update({
        where: { id: existing.id },
        data,
        select: { id: true },
      });
    }
    return this.prisma.residentProfile.create({
      data: { organizationId, ...data },
      select: { id: true },
    });
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

  private async upsertInternalNote(organizationId: string, userId: string, title: string, content: string) {
    if (!content.trim()) return;
    const existing = await this.prisma.clientNote.findFirst({
      where: { organizationId, title },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.clientNote.update({
        where: { id: existing.id },
        data: { content },
      });
      return;
    }
    await this.prisma.clientNote.create({
      data: {
        organizationId,
        createdByUserId: userId,
        title,
        content,
      },
    });
  }

  private findInternalNote(organizationId: string, title: string) {
    return this.prisma.clientNote.findFirst({
      where: { organizationId, title },
      orderBy: { updatedAt: 'desc' },
      select: { content: true },
    });
  }

  private async readOnboardingMetadata(organizationId: string): Promise<OnboardingMetadata> {
    const note = await this.findInternalNote(organizationId, 'Metadata onboarding');
    if (!note?.content) return {};
    try {
      const parsed = JSON.parse(note.content);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private async updateOnboardingMetadata(organizationId: string, userId: string, patch: OnboardingMetadata) {
    const current = await this.readOnboardingMetadata(organizationId);
    const next: OnboardingMetadata = {
      ...current,
      ...patch,
      apartments: {
        ...(current.apartments || {}),
        ...(patch.apartments || {}),
      },
      residents: {
        ...(current.residents || {}),
        ...(patch.residents || {}),
      },
      otherFixedServices: patch.otherFixedServices ?? current.otherFixedServices,
    };
    await this.upsertInternalNote(organizationId, userId, 'Metadata onboarding', JSON.stringify(next));
  }

  private payload(body: unknown): Record<string, any> {
    return body && typeof body === 'object' ? (body as Record<string, any>) : {};
  }

  private requiredString(value: unknown, message: string) {
    if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(message);
    return value.trim();
  }

  private optionalString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : '';
  }

  private optionalInt(value: unknown) {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    return Math.round(parsed);
  }

  private positiveInt(value: unknown, message: string) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) throw new BadRequestException(message);
    return Math.round(parsed);
  }

  private nonNegativeNumber(value: unknown, message: string) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) throw new BadRequestException(message);
    return this.money(parsed);
  }

  private distributeCount(total: number, buckets: number, oneBasedIndex: number) {
    const base = Math.floor(total / buckets);
    const remainder = total % buckets;
    return base + (oneBasedIndex <= remainder ? 1 : 0);
  }

  private parseApartmentStatus(value: unknown) {
    const status = this.optionalString(value).toUpperCase();
    if (status === 'VACANT') return ApartmentStatus.EMPTY;
    if (status === 'OCCUPIED') return ApartmentStatus.OCCUPIED;
    if (status === 'UNKNOWN' || !status) return ApartmentStatus.ACTIVE;
    if (Object.values(ApartmentStatus).includes(status as ApartmentStatus)) return status as ApartmentStatus;
    throw new BadRequestException('Statusul apartamentului nu este valid.');
  }

  private toWizardApartmentStatus(status: ApartmentStatus) {
    if (status === ApartmentStatus.EMPTY) return 'VACANT';
    if (status === ApartmentStatus.OCCUPIED) return 'OCCUPIED';
    return 'UNKNOWN';
  }

  private parseResidentRole(value: unknown) {
    const role = this.optionalString(value).toUpperCase() || 'OWNER';
    const allowed = new Set<string>([ApartmentResidentRole.OWNER, ApartmentResidentRole.TENANT, ApartmentResidentRole.REPRESENTATIVE]);
    if (!allowed.has(role)) throw new BadRequestException('Rolul locatarului nu este valid.');
    return role as ApartmentResidentRole;
  }

  private toWizardResidentRole(role: ApartmentResidentRole) {
    if (role === ApartmentResidentRole.TENANT) return 'TENANT';
    if (role === ApartmentResidentRole.REPRESENTATIVE) return 'REPRESENTATIVE';
    return 'OWNER';
  }

  private parseResidentStatus(value: unknown) {
    const status = this.optionalString(value).toUpperCase() || 'NOT_INVITED';
    if (status === 'ACTIVE') return ResidentAccountStatus.CREATED;
    if (status === 'INVITED') return ResidentAccountStatus.INVITED;
    if (status === 'NOT_INVITED') return ResidentAccountStatus.NO_ACCOUNT;
    throw new BadRequestException('Statusul locatarului nu este valid.');
  }

  private toWizardResidentStatus(status: ResidentAccountStatus) {
    if (status === ResidentAccountStatus.CREATED) return 'ACTIVE';
    if (status === ResidentAccountStatus.INVITED) return 'INVITED';
    return 'NOT_INVITED';
  }

  private toResidentType(role: ApartmentResidentRole) {
    if (role === ApartmentResidentRole.TENANT) return ResidentType.TENANT;
    if (role === ApartmentResidentRole.OWNER) return ResidentType.OWNER;
    return ResidentType.RESIDENT;
  }

  private splitFullName(fullName: string) {
    const parts = fullName.trim().split(/\s+/);
    const firstName = parts.shift() || '';
    return {
      firstName,
      lastName: parts.join(' '),
    };
  }

  private fullName(person: { firstName?: string | null; lastName?: string | null; email?: string | null }) {
    return `${person.firstName || ''} ${person.lastName || ''}`.trim() || person.email || '';
  }

  private legalNameForCode(code: string) {
    return code ? `Asociația de Proprietari din Condominiu ${code}` : '';
  }

  private associationNumberFromCode(code: string) {
    return code.match(/-(\d{4})$/)?.[1] || '';
  }

  private normalizeCountryLabel(value: string) {
    const normalized = value.trim();
    return normalized === 'MD' || normalized.toLowerCase() === 'moldova' ? 'Republica Moldova' : normalized;
  }

  private money(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private isValidMoldovaPhone(value: string) {
    const normalized = String(value || '').replace(/[\s().-]/g, '');
    return /^\+373\d{8}$/.test(normalized) || /^0\d{8}$/.test(normalized);
  }

  private normalizeMoldovaPhone(value: string) {
    const normalized = String(value || '').trim().replace(/[\s().-]/g, '');
    if (/^0\d{8}$/.test(normalized)) return `+373${normalized.slice(1)}`;
    return normalized;
  }
}
