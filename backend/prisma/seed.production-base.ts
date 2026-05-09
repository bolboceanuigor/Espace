import { BillingCurrency, OrganizationStatus, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.organization.upsert({
    where: { id: '9a5c2f00-1111-4d10-a111-0a0000000001' },
    update: {
      name: 'Espace Platform',
      legalName: 'Espace Platform',
      city: 'Chisinau',
      country: 'Republica Moldova',
      currency: BillingCurrency.MDL,
      defaultCurrency: BillingCurrency.MDL,
      status: OrganizationStatus.ACTIVE,
      isActive: true,
      isDemo: false,
      onboardingCompleted: true,
      defaultLocale: 'ro',
      weekStart: 'MONDAY',
    },
    create: {
      id: '9a5c2f00-1111-4d10-a111-0a0000000001',
      name: 'Espace Platform',
      legalName: 'Espace Platform',
      city: 'Chisinau',
      country: 'Republica Moldova',
      currency: BillingCurrency.MDL,
      defaultCurrency: BillingCurrency.MDL,
      status: OrganizationStatus.ACTIVE,
      isActive: true,
      isDemo: false,
      onboardingCompleted: true,
      defaultLocale: 'ro',
      weekStart: 'MONDAY',
    },
  });

  console.log('Platform base organization is ready.');
  console.log('Use npm run seed:production-superadmin to create a production SUPERADMIN if needed.');
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
