import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.upsert({
    where: { id: '9a5c2f00-2222-4d10-a222-0a0000000002' },
    update: {
      name: 'Demo Association',
      isDemo: true,
      isActive: true,
      onboardingCompleted: true,
      defaultLocale: 'ro',
      weekStart: 'MONDAY',
    },
    create: {
      id: '9a5c2f00-2222-4d10-a222-0a0000000002',
      name: 'Demo Association',
      isDemo: true,
      isActive: true,
      onboardingCompleted: true,
      defaultLocale: 'ro',
      weekStart: 'MONDAY',
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'demo.admin@example.invalid' },
    update: {
      organizationId: org.id,
      role: Role.ADMIN,
      isActive: true,
      isDemoUser: true,
      firstName: 'Demo',
      lastName: 'Admin',
      deletedAt: null,
    },
    create: {
      email: 'demo.admin@example.invalid',
      organizationId: org.id,
      role: Role.ADMIN,
      isActive: true,
      isDemoUser: true,
      firstName: 'Demo',
      lastName: 'Admin',
      authProvider: 'LOCAL',
    },
  });

  await prisma.organizationSetting.upsert({
    where: { organizationId: org.id },
    update: { defaultLocale: 'ro', weekStart: 'MONDAY' },
    create: { organizationId: org.id, defaultLocale: 'ro', weekStart: 'MONDAY' },
  });

  await prisma.building.upsert({
    where: { id: '9a5c2f00-3333-4d10-a333-0a0000000003' },
    update: {
      organizationId: org.id,
      name: 'Demo Building',
      address: 'Demo Street 1',
      totalFloors: 5,
    },
    create: {
      id: '9a5c2f00-3333-4d10-a333-0a0000000003',
      organizationId: org.id,
      name: 'Demo Building',
      address: 'Demo Street 1',
      totalFloors: 5,
    },
  });

  console.log('Demo seed completed.');
  console.log('For full demo reset dataset use POST /api/superadmin/demo/reset');
  console.log(`Demo org id: ${org.id}; demo admin id: ${admin.id}`);
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
