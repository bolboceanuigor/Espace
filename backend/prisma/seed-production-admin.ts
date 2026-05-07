import { AuthProvider, BillingCurrency, OrganizationStatus, PlatformRole, PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} este obligatoriu.`);
  }
  return value;
}

async function resolveOrganizationId() {
  const explicitOrganizationId = process.env.PRODUCTION_SUPERADMIN_ORGANIZATION_ID?.trim();

  if (explicitOrganizationId) {
    const organization = await prisma.organization.findUnique({
      where: { id: explicitOrganizationId },
      select: { id: true, name: true },
    });
    if (!organization) {
      throw new Error('PRODUCTION_SUPERADMIN_ORGANIZATION_ID nu există.');
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
      country: 'Moldova',
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
  const organizationId = await resolveOrganizationId();
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      authProvider: AuthProvider.LOCAL,
      firstName: process.env.PRODUCTION_SUPERADMIN_FIRST_NAME?.trim() || 'Platform',
      lastName: process.env.PRODUCTION_SUPERADMIN_LAST_NAME?.trim() || 'Admin',
      phone: process.env.PRODUCTION_SUPERADMIN_PHONE?.trim() || undefined,
      role: Role.SUPERADMIN,
      platformRole: PlatformRole.SUPER_ADMIN,
      organizationId,
      isActive: true,
      isDemoUser: false,
      deletedAt: null,
      emailVerifiedAt: new Date(),
    },
    create: {
      email,
      passwordHash,
      authProvider: AuthProvider.LOCAL,
      firstName: process.env.PRODUCTION_SUPERADMIN_FIRST_NAME?.trim() || 'Platform',
      lastName: process.env.PRODUCTION_SUPERADMIN_LAST_NAME?.trim() || 'Admin',
      phone: process.env.PRODUCTION_SUPERADMIN_PHONE?.trim() || undefined,
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

  console.log('Superadminul de producție este pregătit.');
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
