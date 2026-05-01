import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const organization = await prisma.organization.upsert({
    where: { id: '9a5c2f00-1111-4d10-a111-0a0000000001' },
    update: {
      name: 'Platform Core',
      isActive: true,
      isDemo: false,
      onboardingCompleted: true,
      defaultLocale: 'ro',
      weekStart: 'MONDAY',
    },
    create: {
      id: '9a5c2f00-1111-4d10-a111-0a0000000001',
      name: 'Platform Core',
      isActive: true,
      isDemo: false,
      onboardingCompleted: true,
      defaultLocale: 'ro',
      weekStart: 'MONDAY',
    },
  });

  const email = process.env.SUPERADMIN_EMAIL || 'superadmin@platform.local';
  const passwordHash = await bcrypt.hash(process.env.SUPERADMIN_PASSWORD || 'SuperAdmin123!', 10);
  await prisma.user.upsert({
    where: { email },
    update: {
      organizationId: organization.id,
      role: Role.SUPER_ADMIN,
      passwordHash,
      authProvider: 'LOCAL',
      isActive: true,
      emailVerifiedAt: new Date(),
      firstName: 'Platform',
      lastName: 'Admin',
      deletedAt: null,
    },
    create: {
      email,
      organizationId: organization.id,
      role: Role.SUPER_ADMIN,
      passwordHash,
      authProvider: 'LOCAL',
      isActive: true,
      emailVerifiedAt: new Date(),
      firstName: 'Platform',
      lastName: 'Admin',
    },
  });

  console.log('Production base seed completed.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
