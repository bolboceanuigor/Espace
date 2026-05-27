import { BillingCurrency, LegalDocumentStatus, OrganizationStatus, PrismaClient } from '@prisma/client';
import { LEGAL_DOCUMENT_SEEDS } from '../src/legal/legal.seed';
import { LAUNCH_CHECKLIST_SEEDS, PLATFORM_SERVICE_SEEDS } from '../src/launch-control/launch-control.seed';

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

  for (const document of LEGAL_DOCUMENT_SEEDS) {
    await prisma.legalDocument.upsert({
      where: {
        slug_locale_version: {
          slug: document.slug,
          locale: document.locale,
          version: document.version,
        },
      },
      update: {
        title: document.title,
        description: document.description,
        type: document.type,
        audience: document.audience,
        body: document.body,
        status: LegalDocumentStatus.PUBLISHED,
        isActive: true,
        publishedAt: new Date(),
      },
      create: {
        ...document,
        status: LegalDocumentStatus.PUBLISHED,
        isActive: true,
        publishedAt: new Date(),
      },
    });
  }

  for (const [key, category, title, description, severity, isRequired, actionUrl] of LAUNCH_CHECKLIST_SEEDS) {
    await prisma.launchChecklistItem.upsert({
      where: { key },
      update: { category, title, description, severity, isRequired, actionUrl },
      create: { key, category, title, description, severity, isRequired, actionUrl },
    });
  }

  for (const service of PLATFORM_SERVICE_SEEDS) {
    const existing = await prisma.platformService.findFirst({
      where: { name: service.name, providerName: service.providerName },
      select: { id: true },
    });
    const data = {
      name: service.name,
      type: service.type,
      providerName: service.providerName,
      purpose: service.purpose,
      criticality: service.criticality,
      status: service.status,
      billingCycle: service.billingCycle,
      environmentKeys: service.environmentKeys,
      impactIfDown: service.impactIfDown,
      isRequiredForLaunch: service.isRequiredForLaunch,
    };
    if (existing) await prisma.platformService.update({ where: { id: existing.id }, data });
    else await prisma.platformService.create({ data });
  }

  console.log('Platform base organization is ready.');
  console.log('Legal & Trust seed documents are ready.');
  console.log('Launch checklist and platform service seeds are ready.');
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
