import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CONFIRM_FLAG = '--confirm-delete-demo';

const DEMO_ORGANIZATION_NAMES = ['APC Alba Iulia 75', 'Demo Association'];
const AUTO_DELETE_ORGANIZATION_NAMES = ['Demo Association'];
const DEMO_EMAILS = [
  'admin.demo@espace.md',
  'locatar.demo@espace.md',
  'demo.admin@example.invalid',
];
const DEMO_RESIDENT_NAMES = [
  { firstName: 'Ion', lastName: 'Popescu' },
  { firstName: 'Popescu', lastName: 'Ion' },
];
const DEMO_METER_SERIALS = ['AR-024531'];

type CountKey =
  | 'organizations'
  | 'users'
  | 'apartments'
  | 'residents'
  | 'meters'
  | 'invoices'
  | 'payments'
  | 'issues'
  | 'announcements';

function line(title: string) {
  console.log(`\n${title}`);
  console.log('-'.repeat(title.length));
}

function printRecords<T extends Record<string, unknown>>(
  title: string,
  records: T[],
  format: (record: T) => string,
) {
  line(`${title}: ${records.length}`);
  if (!records.length) {
    console.log('Niciun rezultat.');
    return;
  }
  for (const record of records) {
    console.log(`- ${format(record)}`);
  }
}

async function getCounts(): Promise<Record<CountKey, number>> {
  const [
    organizations,
    users,
    apartments,
    residents,
    meters,
    invoices,
    payments,
    issues,
    announcements,
  ] = await Promise.all([
    prisma.organization.count(),
    prisma.user.count(),
    prisma.apartment.count(),
    prisma.residentProfile.count(),
    prisma.meter.count(),
    prisma.invoice.count(),
    prisma.payment.count(),
    prisma.issue.count(),
    prisma.announcement.count(),
  ]);

  return {
    organizations,
    users,
    apartments,
    residents,
    meters,
    invoices,
    payments,
    issues,
    announcements,
  };
}

async function inspectDemoData() {
  const counts = await getCounts();

  const demoOrganizations = await prisma.organization.findMany({
    where: {
      OR: [
        { isDemo: true },
        { name: { in: DEMO_ORGANIZATION_NAMES } },
        { legalName: { in: DEMO_ORGANIZATION_NAMES } },
      ],
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      legalName: true,
      fiscalCode: true,
      city: true,
      isDemo: true,
      createdAt: true,
      _count: {
        select: {
          users: true,
          buildings: true,
          staircases: true,
          apartments: true,
          residentProfiles: true,
          meters: true,
          invoices: true,
          payments: true,
          issues: true,
          publicAnnouncements: true,
        },
      },
    },
  });

  const demoOrganizationIds = demoOrganizations.map((organization) => organization.id);

  const demoUsers = await prisma.user.findMany({
    where: {
      OR: [
        { isDemoUser: true },
        { email: { in: DEMO_EMAILS } },
        { email: { contains: '.demo' } },
        { email: { endsWith: 'example.invalid' } },
      ],
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      organizationId: true,
      isDemoUser: true,
      createdAt: true,
      organization: {
        select: {
          name: true,
          isDemo: true,
        },
      },
    },
  });

  const demoResidents = await prisma.residentProfile.findMany({
    where: {
      OR: [
        { email: { in: DEMO_EMAILS } },
        ...DEMO_RESIDENT_NAMES.map((name) => ({
          firstName: name.firstName,
          lastName: name.lastName,
        })),
        { organizationId: { in: demoOrganizationIds } },
      ],
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      organizationId: true,
      apartmentId: true,
      organization: {
        select: {
          name: true,
          isDemo: true,
        },
      },
      apartment: {
        select: {
          number: true,
        },
      },
    },
  });

  const demoApartments = await prisma.apartment.findMany({
    where: {
      OR: [
        { organizationId: { in: demoOrganizationIds } },
        { number: '45', organization: { name: { in: DEMO_ORGANIZATION_NAMES } } },
      ],
    },
    orderBy: [{ organizationId: 'asc' }, { number: 'asc' }],
    select: {
      id: true,
      number: true,
      floor: true,
      organizationId: true,
      organization: {
        select: {
          name: true,
          isDemo: true,
        },
      },
      staircase: {
        select: {
          name: true,
        },
      },
    },
  });

  const demoMeters = await prisma.meter.findMany({
    where: {
      OR: [
        { serialNumber: { in: DEMO_METER_SERIALS } },
        { organizationId: { in: demoOrganizationIds } },
      ],
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      serialNumber: true,
      type: true,
      organizationId: true,
      apartment: {
        select: {
          number: true,
        },
      },
      organization: {
        select: {
          name: true,
          isDemo: true,
        },
      },
    },
  });

  return {
    counts,
    demoOrganizations,
    demoUsers,
    demoResidents,
    demoApartments,
    demoMeters,
  };
}

async function deleteConfirmedDemoData() {
  const totalOrganizations = await prisma.organization.count();
  const organizationsToDelete = await prisma.organization.findMany({
    where: {
      isDemo: true,
      name: { in: AUTO_DELETE_ORGANIZATION_NAMES },
    },
    select: { id: true, name: true },
  });

  if (!organizationsToDelete.length) {
    console.log('Nu există asociații demo marcate sigur pentru ștergere automată.');
    console.log('Datele demo nemarcate explicit trebuie verificate manual.');
    return;
  }

  if (organizationsToDelete.length >= totalOrganizations) {
    throw new Error('Siguranță activată: scriptul refuză să șteargă toate asociațiile.');
  }

  line('Ștergere confirmată');
  for (const organization of organizationsToDelete) {
    console.log(`- Se șterge doar asociația demo marcată explicit: ${organization.name} (${organization.id})`);
  }

  await prisma.organization.deleteMany({
    where: { id: { in: organizationsToDelete.map((organization) => organization.id) } },
  });

  console.log('Ștergerea demo marcată explicit a fost finalizată.');
}

async function main() {
  const shouldDelete = process.argv.includes(CONFIRM_FLAG);
  const inspection = await inspectDemoData();

  line('Numărări curente');
  for (const [name, count] of Object.entries(inspection.counts)) {
    console.log(`- ${name}: ${count}`);
  }

  printRecords('Asociații demo/test detectate', inspection.demoOrganizations, (organization) => {
    const counts = organization._count;
    const marker = organization.isDemo ? 'isDemo=true' : 'manual-review';
    return `${organization.name} (${marker}) | id=${organization.id} | ap=${counts.apartments}, locatari=${counts.residentProfiles}, utilizatori=${counts.users}`;
  });

  printRecords('Utilizatori demo/test detectați', inspection.demoUsers, (user) => {
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || '-';
    const marker = user.isDemoUser || user.organization?.isDemo ? 'demo-flag' : 'manual-review';
    return `${user.email} | ${name} | rol=${user.role} | asociație=${user.organization?.name || user.organizationId} | ${marker}`;
  });

  printRecords('Locatari demo/test detectați', inspection.demoResidents, (resident) => {
    const name = [resident.firstName, resident.lastName].filter(Boolean).join(' ') || '-';
    return `${name} | email=${resident.email || '-'} | apt=${resident.apartment?.number || '-'} | asociație=${resident.organization?.name || resident.organizationId}`;
  });

  printRecords('Apartamente demo/test detectate', inspection.demoApartments, (apartment) => {
    return `Apt. ${apartment.number} | scara=${apartment.staircase?.name || '-'} | etaj=${apartment.floor ?? '-'} | asociație=${apartment.organization?.name || apartment.organizationId}`;
  });

  printRecords('Contoare demo/test detectate', inspection.demoMeters, (meter) => {
    return `${meter.serialNumber || '-'} | tip=${meter.type} | apt=${meter.apartment?.number || '-'} | asociație=${meter.organization?.name || meter.organizationId}`;
  });

  line('Mod rulare');
  if (!shouldDelete) {
    console.log('Dry-run: nu a fost ștearsă nicio înregistrare.');
    console.log(`Pentru ștergere limitată la demo marcat explicit, rulează cu ${CONFIRM_FLAG}.`);
    return;
  }

  await deleteConfirmedDemoData();
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
