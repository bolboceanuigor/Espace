import {
  AnnouncementCategory,
  AnnouncementStatus,
  ApartmentResidentRole,
  ApartmentStatus,
  AuthProvider,
  BillingCurrency,
  ContentImportance,
  InvoiceStatus,
  IssueCategory,
  IssueLocationType,
  IssuePriority,
  IssueStatus,
  MeterReadingSource,
  MeterStatus,
  MeterType,
  OrganizationStatus,
  PaymentMethod,
  PaymentStatus,
  PlatformRole,
  PrismaClient,
  ResidentAccountStatus,
  ResidentType,
  Role,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const ORGANIZATION_NAME = 'APC Alba Iulia 75';
const DEMO_PASSWORD = 'EspaceDemo123!';

function passwordFromEnv(key: string) {
  return process.env[key] || DEMO_PASSWORD;
}

async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

async function upsertUser(input: {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: Role;
  platformRole: PlatformRole;
  organizationId: string;
}) {
  return prisma.user.upsert({
    where: { email: input.email },
    update: {
      passwordHash: input.passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      role: input.role,
      platformRole: input.platformRole,
      authProvider: AuthProvider.LOCAL,
      emailVerifiedAt: new Date(),
      organizationId: input.organizationId,
      isActive: true,
      deletedAt: null,
    },
    create: {
      email: input.email,
      passwordHash: input.passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      role: input.role,
      platformRole: input.platformRole,
      authProvider: AuthProvider.LOCAL,
      emailVerifiedAt: new Date(),
      organizationId: input.organizationId,
      isActive: true,
    },
  });
}

async function findOrCreateBuilding(organizationId: string) {
  const existing = await prisma.building.findFirst({
    where: { organizationId, name: 'Bloc principal' },
  });
  const data = {
    organizationId,
    name: 'Bloc principal',
    address: 'str. Alba Iulia 75',
    staircasesCount: 4,
    apartmentsCount: 142,
    totalFloors: 10,
  };
  if (existing) return prisma.building.update({ where: { id: existing.id }, data });
  return prisma.building.create({ data });
}

async function findOrCreateStaircase(organizationId: string, buildingId: string, name: string) {
  const existing = await prisma.staircase.findFirst({
    where: { organizationId, buildingId, name },
  });
  const data = { organizationId, buildingId, name, floorsCount: 10 };
  if (existing) return prisma.staircase.update({ where: { id: existing.id }, data });
  return prisma.staircase.create({ data });
}

async function upsertApartment(input: {
  organizationId: string;
  buildingId: string;
  staircaseId: string;
  number: string;
  floor: number;
  areaM2: number;
  rooms: number;
  status: ApartmentStatus;
}) {
  return prisma.apartment.upsert({
    where: {
      staircaseId_number: {
        staircaseId: input.staircaseId,
        number: input.number,
      },
    },
    update: {
      organizationId: input.organizationId,
      buildingId: input.buildingId,
      floor: input.floor,
      areaM2: input.areaM2,
      rooms: input.rooms,
      status: input.status,
    },
    create: input,
  });
}

async function upsertResident(input: {
  organizationId: string;
  apartmentId: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  userId?: string;
  type: ResidentType;
  isPrimary?: boolean;
}) {
  const existing =
    (input.email
      ? await prisma.residentProfile.findFirst({
          where: { organizationId: input.organizationId, email: input.email },
        })
      : null) ??
    (await prisma.residentProfile.findFirst({
      where: {
        organizationId: input.organizationId,
        firstName: input.firstName,
        lastName: input.lastName,
        apartmentId: input.apartmentId,
      },
    }));

  const data = {
    organizationId: input.organizationId,
    apartmentId: input.apartmentId,
    userId: input.userId,
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    email: input.email,
    type: input.type,
    isPrimary: input.isPrimary ?? false,
    accountStatus: input.userId ? ResidentAccountStatus.CREATED : ResidentAccountStatus.NO_ACCOUNT,
  };

  if (existing) return prisma.residentProfile.update({ where: { id: existing.id }, data });
  return prisma.residentProfile.create({ data });
}

async function upsertApartmentResident(input: {
  apartmentId: string;
  residentId: string;
  role: ApartmentResidentRole;
  isPrimary?: boolean;
}) {
  return prisma.apartmentResident.upsert({
    where: {
      apartmentId_residentId_role: {
        apartmentId: input.apartmentId,
        residentId: input.residentId,
        role: input.role,
      },
    },
    update: { isPrimary: input.isPrimary ?? false },
    create: {
      apartmentId: input.apartmentId,
      residentId: input.residentId,
      role: input.role,
      isPrimary: input.isPrimary ?? false,
    },
  });
}

async function upsertMeter(input: {
  organizationId: string;
  apartmentId: string;
  type: MeterType;
  serialNumber: string;
  status?: MeterStatus;
}) {
  const existing = await prisma.meter.findFirst({
    where: {
      organizationId: input.organizationId,
      apartmentId: input.apartmentId,
      serialNumber: input.serialNumber,
    },
  });
  const data = {
    organizationId: input.organizationId,
    apartmentId: input.apartmentId,
    type: input.type,
    serialNumber: input.serialNumber,
    status: input.status ?? MeterStatus.ACTIVE,
  };
  if (existing) return prisma.meter.update({ where: { id: existing.id }, data });
  return prisma.meter.create({ data });
}

async function upsertReading(input: {
  organizationId: string;
  apartmentId: string;
  meterId: string;
  value: number;
  readingDate: Date;
}) {
  const start = new Date(input.readingDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const existing = await prisma.meterReading.findFirst({
    where: {
      meterId: input.meterId,
      readingDate: { gte: start, lt: end },
    },
  });
  const data = {
    organizationId: input.organizationId,
    apartmentId: input.apartmentId,
    meterId: input.meterId,
    value: input.value,
    readingDate: input.readingDate,
    source: MeterReadingSource.ADMIN,
  };
  if (existing) return prisma.meterReading.update({ where: { id: existing.id }, data });
  return prisma.meterReading.create({ data });
}

async function upsertInvoice(input: {
  organizationId: string;
  apartmentId: string;
  month: number;
  year: number;
  amount: number;
  status: InvoiceStatus;
  paidAt?: Date | null;
  dueDate: Date;
}) {
  const existing = await prisma.invoice.findFirst({
    where: {
      organizationId: input.organizationId,
      apartmentId: input.apartmentId,
      month: input.month,
      year: input.year,
      plan: 'apartment-monthly',
    },
  });
  const data = {
    organizationId: input.organizationId,
    apartmentId: input.apartmentId,
    month: input.month,
    year: input.year,
    plan: 'apartment-monthly',
    amount: input.amount,
    discount: 0,
    finalAmount: input.amount,
    status: input.status,
    paidAt: input.paidAt ?? null,
    dueDate: input.dueDate,
  };
  if (existing) return prisma.invoice.update({ where: { id: existing.id }, data });
  return prisma.invoice.create({ data });
}

async function upsertPayment(input: {
  organizationId: string;
  apartmentId: string;
  amount: number;
  paidAt: Date;
  createdByUserId: string;
}) {
  const existing = await prisma.payment.findFirst({
    where: {
      organizationId: input.organizationId,
      apartmentId: input.apartmentId,
      amount: input.amount,
      month: '2026-05',
      note: 'Demo payment Apt. 12',
    },
  });
  const data = {
    organizationId: input.organizationId,
    apartmentId: input.apartmentId,
    amount: input.amount,
    currency: BillingCurrency.MDL,
    method: PaymentMethod.BANK_TRANSFER,
    status: PaymentStatus.CONFIRMED,
    note: 'Demo payment Apt. 12',
    createdByUserId: input.createdByUserId,
    confirmedAt: input.paidAt,
    paidAt: input.paidAt,
    month: '2026-05',
  };
  if (existing) return prisma.payment.update({ where: { id: existing.id }, data });
  return prisma.payment.create({ data });
}

async function upsertIssue(input: {
  organizationId: string;
  apartmentId?: string;
  residentId?: string;
  buildingId?: string;
  staircaseId?: string;
  createdByUserId: string;
  title: string;
  description: string;
  category: IssueCategory;
  priority: IssuePriority;
  status: IssueStatus;
}) {
  const existing = await prisma.issue.findFirst({
    where: { organizationId: input.organizationId, title: input.title },
  });
  const data = {
    organizationId: input.organizationId,
    apartmentId: input.apartmentId,
    residentId: input.residentId,
    buildingId: input.buildingId,
    staircaseId: input.staircaseId,
    createdByUserId: input.createdByUserId,
    title: input.title,
    description: input.description,
    category: input.category,
    locationType: input.apartmentId ? IssueLocationType.APARTMENT : IssueLocationType.STAIRCASE,
    priority: input.priority,
    status: input.status,
    resolvedAt: input.status === IssueStatus.RESOLVED ? new Date('2026-05-02T10:00:00.000Z') : null,
  };
  if (existing) return prisma.issue.update({ where: { id: existing.id }, data });
  return prisma.issue.create({ data });
}

async function upsertAnnouncement(input: {
  organizationId: string;
  createdByUserId: string;
  title: string;
  content: string;
  category: AnnouncementCategory;
  importance?: ContentImportance;
}) {
  const existing = await prisma.announcement.findFirst({
    where: { organizationId: input.organizationId, title: input.title },
  });
  const data = {
    organizationId: input.organizationId,
    createdById: input.createdByUserId,
    createdByUserId: input.createdByUserId,
    title: input.title,
    content: input.content,
    category: input.category,
    status: AnnouncementStatus.ACTIVE,
    importance: input.importance ?? ContentImportance.NORMAL,
  };
  if (existing) return prisma.announcement.update({ where: { id: existing.id }, data });
  return prisma.announcement.create({ data });
}

async function upsertDemoThread(input: {
  organizationId: string;
  apartmentId: string;
  residentId: string;
  adminId: string;
  residentUserId: string;
}) {
  const subject = 'Demo Apt. 45 - discuție administrație';
  const thread =
    (await prisma.messageThread.findFirst({
      where: { organizationId: input.organizationId, apartmentId: input.apartmentId, subject },
    })) ??
    (await prisma.messageThread.create({
      data: {
        organizationId: input.organizationId,
        apartmentId: input.apartmentId,
        residentId: input.residentId,
        subject,
      },
    }));

  const messages = [
    {
      senderId: input.residentUserId,
      content: 'Bună ziua, liftul de pe Scara 2 se oprește greu la etajul 6.',
      createdAt: new Date('2026-05-03T09:15:00.000Z'),
    },
    {
      senderId: input.adminId,
      content: 'Mulțumim, am preluat cererea și trimitem echipa de mentenanță astăzi.',
      createdAt: new Date('2026-05-03T09:24:00.000Z'),
    },
  ];

  for (const message of messages) {
    const existing = await prisma.message.findFirst({
      where: { threadId: thread.id, senderId: message.senderId, content: message.content },
    });
    if (existing) {
      await prisma.message.update({ where: { id: existing.id }, data: message });
    } else {
      await prisma.message.create({ data: { threadId: thread.id, ...message } });
    }
  }

  return thread;
}

async function main() {
  const usingFallbackPassword = !process.env.SEED_SUPERADMIN_PASSWORD;
  const superadminPasswordHash = await hashPassword(passwordFromEnv('SEED_SUPERADMIN_PASSWORD'));
  const adminPasswordHash = await hashPassword(passwordFromEnv('SEED_ADMIN_PASSWORD'));
  const residentPasswordHash = await hashPassword(passwordFromEnv('SEED_RESIDENT_PASSWORD'));

  const organization =
    (await prisma.organization.findFirst({ where: { name: ORGANIZATION_NAME } })) ??
    (await prisma.organization.create({
      data: {
        name: ORGANIZATION_NAME,
        address: 'str. Alba Iulia 75',
        city: 'Chișinău',
        country: 'Moldova',
        currency: BillingCurrency.MDL,
        defaultCurrency: BillingCurrency.MDL,
        status: OrganizationStatus.ACTIVE,
        isActive: true,
        onboardingCompleted: true,
        defaultLocale: 'ro',
        weekStart: 'MONDAY',
      },
    }));

  await prisma.organization.update({
    where: { id: organization.id },
    data: {
      name: ORGANIZATION_NAME,
      address: 'str. Alba Iulia 75',
      city: 'Chișinău',
      country: 'Moldova',
      currency: BillingCurrency.MDL,
      defaultCurrency: BillingCurrency.MDL,
      status: OrganizationStatus.ACTIVE,
      isActive: true,
      onboardingCompleted: true,
      defaultLocale: 'ro',
      weekStart: 'MONDAY',
    },
  });

  await prisma.organizationSetting.upsert({
    where: { organizationId: organization.id },
    update: {
      maintenanceFeePerM2: 3.5,
      repairFundPerM2: 1.2,
      developmentFundFixed: 80,
      contactPhone: '+373 60 000 075',
      contactEmail: 'admin.demo@espace.md',
      workingHours: 'Luni-Vineri, 09:00-18:00',
      appName: 'Espace',
      defaultLocale: 'ro',
      weekStart: 'MONDAY',
    },
    create: {
      organizationId: organization.id,
      maintenanceFeePerM2: 3.5,
      repairFundPerM2: 1.2,
      developmentFundFixed: 80,
      contactPhone: '+373 60 000 075',
      contactEmail: 'admin.demo@espace.md',
      workingHours: 'Luni-Vineri, 09:00-18:00',
      appName: 'Espace',
      defaultLocale: 'ro',
      weekStart: 'MONDAY',
    },
  });

  const trialPlan = await prisma.plan.upsert({
    where: { code: 'TRIAL' },
    update: { name: 'Trial', priceMonthly: 0, currency: 'MDL' },
    create: { code: 'TRIAL', name: 'Trial', priceMonthly: 0, currency: 'MDL' },
  });

  const trialEndsAt = new Date('2026-06-01T00:00:00.000Z');
  await prisma.subscription.upsert({
    where: { organizationId: organization.id },
    update: {
      planId: trialPlan.id,
      plan: 'starter',
      status: 'TRIAL',
      price: 0,
      apartmentLimit: 250,
      trialEndsAt,
      isActive: true,
    },
    create: {
      organizationId: organization.id,
      planId: trialPlan.id,
      plan: 'starter',
      status: 'TRIAL',
      currentPeriodStart: new Date('2026-05-01T00:00:00.000Z'),
      currentPeriodEnd: trialEndsAt,
      price: 0,
      apartmentLimit: 250,
      trialEndsAt,
      isActive: true,
    },
  });

  const superadmin = await upsertUser({
    email: 'bolboceanuigor@gmail.com',
    passwordHash: superadminPasswordHash,
    firstName: 'Igor',
    lastName: 'Bolboceanu',
    phone: '+373 60 000 001',
    role: Role.SUPERADMIN,
    platformRole: PlatformRole.SUPER_ADMIN,
    organizationId: organization.id,
  });

  const admin = await upsertUser({
    email: 'admin.demo@espace.md',
    passwordHash: adminPasswordHash,
    firstName: 'Admin',
    lastName: 'Espace',
    phone: '+373 60 000 002',
    role: Role.ADMIN,
    platformRole: PlatformRole.ORGANIZATION_USER,
    organizationId: organization.id,
  });

  const residentUser = await upsertUser({
    email: 'locatar.demo@espace.md',
    passwordHash: residentPasswordHash,
    firstName: 'Ion',
    lastName: 'Popescu',
    phone: '+373 60 000 045',
    role: Role.RESIDENT,
    platformRole: PlatformRole.RESIDENT,
    organizationId: organization.id,
  });

  const building = await findOrCreateBuilding(organization.id);
  const staircases = await Promise.all(
    ['Scara 1', 'Scara 2', 'Scara 3', 'Scara 4'].map((name) =>
      findOrCreateStaircase(organization.id, building.id, name),
    ),
  );
  const staircaseByName = Object.fromEntries(staircases.map((staircase) => [staircase.name, staircase]));

  const apt45 = await upsertApartment({
    organizationId: organization.id,
    buildingId: building.id,
    staircaseId: staircaseByName['Scara 2'].id,
    number: '45',
    floor: 6,
    areaM2: 72.4,
    rooms: 3,
    status: ApartmentStatus.DEBTOR,
  });
  const apt12 = await upsertApartment({
    organizationId: organization.id,
    buildingId: building.id,
    staircaseId: staircaseByName['Scara 1'].id,
    number: '12',
    floor: 3,
    areaM2: 48.2,
    rooms: 2,
    status: ApartmentStatus.ACTIVE,
  });
  const apt87 = await upsertApartment({
    organizationId: organization.id,
    buildingId: building.id,
    staircaseId: staircaseByName['Scara 3'].id,
    number: '87',
    floor: 8,
    areaM2: 64.0,
    rooms: 3,
    status: ApartmentStatus.ACTIVE,
  });
  const apt103 = await upsertApartment({
    organizationId: organization.id,
    buildingId: building.id,
    staircaseId: staircaseByName['Scara 4'].id,
    number: '103',
    floor: 5,
    areaM2: 39.7,
    rooms: 1,
    status: ApartmentStatus.PROBLEM,
  });
  await upsertApartment({
    organizationId: organization.id,
    buildingId: building.id,
    staircaseId: staircaseByName['Scara 1'].id,
    number: '8',
    floor: 2,
    areaM2: 55.0,
    rooms: 2,
    status: ApartmentStatus.EMPTY,
  });

  const popescuIon = await upsertResident({
    organizationId: organization.id,
    apartmentId: apt45.id,
    userId: residentUser.id,
    firstName: 'Popescu',
    lastName: 'Ion',
    phone: '+373 60 000 045',
    email: 'locatar.demo@espace.md',
    type: ResidentType.OWNER,
    isPrimary: true,
  });
  const popescuMaria = await upsertResident({
    organizationId: organization.id,
    apartmentId: apt45.id,
    firstName: 'Popescu',
    lastName: 'Maria',
    phone: '+373 60 000 046',
    type: ResidentType.RESIDENT,
  });
  const popescuAndrei = await upsertResident({
    organizationId: organization.id,
    apartmentId: apt45.id,
    firstName: 'Popescu',
    lastName: 'Andrei',
    phone: '+373 60 000 047',
    type: ResidentType.RESIDENT,
  });
  const rusuElena = await upsertResident({
    organizationId: organization.id,
    apartmentId: apt12.id,
    firstName: 'Rusu',
    lastName: 'Elena',
    phone: '+373 60 000 012',
    email: 'rusu.elena.demo@espace.md',
    type: ResidentType.OWNER,
    isPrimary: true,
  });
  const cebanMihai = await upsertResident({
    organizationId: organization.id,
    apartmentId: apt87.id,
    firstName: 'Ceban',
    lastName: 'Mihai',
    phone: '+373 60 000 087',
    email: 'ceban.mihai.demo@espace.md',
    type: ResidentType.OWNER,
    isPrimary: true,
  });

  await prisma.apartment.update({ where: { id: apt45.id }, data: { ownerResidentId: popescuIon.id } });
  await prisma.apartment.update({ where: { id: apt12.id }, data: { ownerResidentId: rusuElena.id } });
  await prisma.apartment.update({ where: { id: apt87.id }, data: { ownerResidentId: cebanMihai.id } });

  await Promise.all([
    upsertApartmentResident({ apartmentId: apt45.id, residentId: popescuIon.id, role: ApartmentResidentRole.OWNER, isPrimary: true }),
    upsertApartmentResident({ apartmentId: apt45.id, residentId: popescuMaria.id, role: ApartmentResidentRole.FAMILY_MEMBER }),
    upsertApartmentResident({ apartmentId: apt45.id, residentId: popescuAndrei.id, role: ApartmentResidentRole.RESIDENT }),
    upsertApartmentResident({ apartmentId: apt12.id, residentId: rusuElena.id, role: ApartmentResidentRole.OWNER, isPrimary: true }),
    upsertApartmentResident({ apartmentId: apt87.id, residentId: cebanMihai.id, role: ApartmentResidentRole.OWNER, isPrimary: true }),
  ]);

  const ar024531 = await upsertMeter({
    organizationId: organization.id,
    apartmentId: apt45.id,
    type: MeterType.COLD_WATER,
    serialNumber: 'AR-024531',
  });
  const ac018992 = await upsertMeter({
    organizationId: organization.id,
    apartmentId: apt45.id,
    type: MeterType.HOT_WATER,
    serialNumber: 'AC-018992',
  });
  await upsertMeter({
    organizationId: organization.id,
    apartmentId: apt45.id,
    type: MeterType.GAS,
    serialNumber: 'GZ-771209',
    status: MeterStatus.MISSING_READING,
  });
  await upsertMeter({
    organizationId: organization.id,
    apartmentId: apt12.id,
    type: MeterType.COLD_WATER,
    serialNumber: 'AR-120012',
  });
  await upsertMeter({
    organizationId: organization.id,
    apartmentId: apt12.id,
    type: MeterType.HOT_WATER,
    serialNumber: 'AC-120012',
  });

  await Promise.all([
    upsertReading({
      organizationId: organization.id,
      apartmentId: apt45.id,
      meterId: ar024531.id,
      value: 124,
      readingDate: new Date('2026-05-01T09:00:00.000Z'),
    }),
    upsertReading({
      organizationId: organization.id,
      apartmentId: apt45.id,
      meterId: ac018992.id,
      value: 89,
      readingDate: new Date('2026-05-01T09:05:00.000Z'),
    }),
  ]);

  await Promise.all([
    upsertInvoice({
      organizationId: organization.id,
      apartmentId: apt45.id,
      month: 5,
      year: 2026,
      amount: 1240,
      status: InvoiceStatus.OVERDUE,
      dueDate: new Date('2026-05-25T00:00:00.000Z'),
    }),
    upsertInvoice({
      organizationId: organization.id,
      apartmentId: apt12.id,
      month: 5,
      year: 2026,
      amount: 420,
      status: InvoiceStatus.PAID,
      paidAt: new Date('2026-05-05T10:15:00.000Z'),
      dueDate: new Date('2026-05-25T00:00:00.000Z'),
    }),
    upsertInvoice({
      organizationId: organization.id,
      apartmentId: apt87.id,
      month: 5,
      year: 2026,
      amount: 630,
      status: InvoiceStatus.UNPAID,
      dueDate: new Date('2026-05-25T00:00:00.000Z'),
    }),
  ]);

  await upsertPayment({
    organizationId: organization.id,
    apartmentId: apt12.id,
    amount: 420,
    paidAt: new Date('2026-05-05T10:15:00.000Z'),
    createdByUserId: admin.id,
  });

  await Promise.all([
    upsertIssue({
      organizationId: organization.id,
      apartmentId: apt45.id,
      residentId: popescuIon.id,
      createdByUserId: residentUser.id,
      title: 'Lift defect',
      description: 'Liftul de pe Scara 2 se oprește greu la etajul 6.',
      category: IssueCategory.ELEVATOR,
      priority: IssuePriority.URGENT,
      status: IssueStatus.NEW,
    }),
    upsertIssue({
      organizationId: organization.id,
      apartmentId: apt103.id,
      createdByUserId: admin.id,
      title: 'Scurgere apă',
      description: 'Scurgere vizibilă în zona coloanei de apă.',
      category: IssueCategory.WATER,
      priority: IssuePriority.IMPORTANT,
      status: IssueStatus.IN_PROGRESS,
    }),
    upsertIssue({
      organizationId: organization.id,
      buildingId: building.id,
      staircaseId: staircaseByName['Scara 2'].id,
      createdByUserId: admin.id,
      title: 'Curățenie pe scară',
      description: 'Curățenie suplimentară efectuată pe Scara 2.',
      category: IssueCategory.CLEANING,
      priority: IssuePriority.NORMAL,
      status: IssueStatus.RESOLVED,
    }),
  ]);

  await Promise.all([
    upsertAnnouncement({
      organizationId: organization.id,
      createdByUserId: admin.id,
      title: 'Lucrări programate la lift',
      content: 'Pe 10 mai vor avea loc lucrări programate la liftul de pe Scara 2.',
      category: AnnouncementCategory.REPAIR,
      importance: ContentImportance.URGENT,
    }),
    upsertAnnouncement({
      organizationId: organization.id,
      createdByUserId: admin.id,
      title: 'Colectarea citirilor contoarelor',
      content: 'Vă rugăm să transmiteți citirile contoarelor până pe 25 mai.',
      category: AnnouncementCategory.ADMINISTRATION,
      importance: ContentImportance.IMPORTANT,
    }),
    upsertAnnouncement({
      organizationId: organization.id,
      createdByUserId: admin.id,
      title: 'Ședință generală a locatarilor',
      content: 'Ședința generală va avea loc în holul blocului principal, la ora 18:30.',
      category: AnnouncementCategory.GENERAL,
    }),
  ]);

  await upsertDemoThread({
    organizationId: organization.id,
    apartmentId: apt45.id,
    residentId: popescuIon.id,
    adminId: admin.id,
    residentUserId: residentUser.id,
  });

  const counts = await Promise.all([
    prisma.user.count(),
    prisma.organization.count(),
    prisma.apartment.count({ where: { organizationId: organization.id } }),
    prisma.invoice.count({ where: { organizationId: organization.id } }),
    prisma.issue.count({ where: { organizationId: organization.id } }),
  ]);

  console.log('Seed completed for Espace demo data.');
  if (usingFallbackPassword) {
    console.log('SEED_SUPERADMIN_PASSWORD was not set; a temporary demo password was used and must be changed.');
  }
  console.log(
    JSON.stringify(
      {
        users: counts[0],
        organizations: counts[1],
        apartments: counts[2],
        invoices: counts[3],
        issues: counts[4],
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
