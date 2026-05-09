import {
  AuthProvider,
  BillingCurrency,
  OrganizationStatus,
  PlatformRole,
  PrismaClient,
  Role,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} este obligatoriu. Nu a fost creat niciun utilizator.`);
  }
  return value;
}

async function resolveOrganizationId() {
  const explicitOrganizationId = process.env.PRODUCTION_SUPERADMIN_ORGANIZATION_ID?.trim();

  if (explicitOrganizationId) {
    const organization = await prisma.organization.findUnique({
      where: { id: explicitOrganizationId },
      select: { id: true },
    });
    if (!organization) {
      throw new Error('PRODUCTION_SUPERADMIN_ORGANIZATION_ID nu există. Nu a fost creat niciun utilizator.');
    }
    return organization.id;
  }

  const existingOrganization = await prisma.organization.findFirst({
    where: { isDemo: false },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });

  if (existingOrganization) {
    return existingOrganization.id;
  }

  const organization = await prisma.organization.create({
    data: {
      name: 'Espace Platform',
      legalName: 'Espace Platform',
      city: 'Chișinău',
      country: 'Republica Moldova',
      currency: BillingCurrency.MDL,
      defaultCurrency: BillingCurrency.MDL,
      status: OrganizationStatus.ACTIVE,
      isDemo: false,
      isActive: true,
      onboardingCompleted: true,
      defaultLocale: 'ro',
      weekStart: 'MONDAY',
    },
    select: { id: true },
  });

  return organization.id;
}

async function main() {
  const email = requiredEnv('PRODUCTION_SUPERADMIN_EMAIL').toLowerCase();
  const password = requiredEnv('PRODUCTION_SUPERADMIN_PASSWORD');

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      role: true,
      platformRole: true,
      isActive: true,
      deletedAt: true,
    },
  });

  if (existingUser) {
    if (
      existingUser.role !== Role.SUPERADMIN ||
      existingUser.platformRole !== PlatformRole.SUPER_ADMIN ||
      existingUser.deletedAt
    ) {
      throw new Error(
        'Există deja un utilizator cu acest email, dar nu este SUPERADMIN activ. Nu s-au făcut modificări.',
      );
    }

    console.log('Superadminul de producție există deja. Nu s-au făcut modificări.');
    console.log(`- id: ${existingUser.id}`);
    console.log(`- email: ${existingUser.email}`);
    console.log(`- rol: ${existingUser.role}`);
    return;
  }

  const organizationId = await resolveOrganizationId();
  const passwordHash = await bcrypt.hash(password, 10);
  const firstName = process.env.PRODUCTION_SUPERADMIN_FIRST_NAME?.trim() || 'Platform';
  const lastName = process.env.PRODUCTION_SUPERADMIN_LAST_NAME?.trim() || 'Admin';
  const phone = process.env.PRODUCTION_SUPERADMIN_PHONE?.trim() || undefined;

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      authProvider: AuthProvider.LOCAL,
      firstName,
      lastName,
      phone,
      role: Role.SUPERADMIN,
      platformRole: PlatformRole.SUPER_ADMIN,
      organizationId,
      isActive: true,
      isDemoUser: false,
      emailVerifiedAt: new Date(),
    },
    select: {
      id: true,
      email: true,
      role: true,
      platformRole: true,
      organizationId: true,
    },
  });

  console.log('Superadminul de producție a fost creat.');
  console.log(`- id: ${user.id}`);
  console.log(`- email: ${user.email}`);
  console.log(`- rol: ${user.role}`);
  console.log(`- organizație: ${user.organizationId}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
