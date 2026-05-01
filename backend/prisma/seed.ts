import { PlanCode, PrismaClient, ReservationStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { addDays } from 'date-fns';

const prisma = new PrismaClient();
const isProduction = process.env.NODE_ENV === 'production';
const seedDemo = !isProduction && (process.env.SEED_DEMO ?? 'true').toLowerCase() === 'true';
const canSeed =
  !isProduction ||
  (process.env.SEED ?? 'false').toLowerCase() === 'true';

async function main() {
  if (!canSeed) {
    console.log('Skipping seed in production (set SEED=true to enable)');
    return;
  }
  if (!seedDemo) {
    console.log('SEED_DEMO disabled, skipping demo seed data.');
    return;
  }
  const hqName = 'Espace HQ';
  const testOrgName = 'Test Org';
  const organization =
    (await prisma.organization.findFirst({
      where: { name: hqName, isActive: true },
      select: { id: true },
    })) ??
    (await prisma.organization.create({
      data: {
        name: hqName,
        onboardingCompleted: true,
        defaultLocale: 'ro',
        weekStart: 'MONDAY',
      },
      select: { id: true },
    }));

  await prisma.organization.update({
    where: { id: organization.id },
    data: {
      name: hqName,
      onboardingCompleted: true,
      defaultLocale: 'ro',
      weekStart: 'MONDAY',
    },
  });

  await prisma.organizationSetting.upsert({
    where: { organizationId: organization.id },
    update: { defaultLocale: 'ro', weekStart: 'MONDAY' },
    create: { organizationId: organization.id, defaultLocale: 'ro', weekStart: 'MONDAY' },
  });

  const testOrganization =
    (await prisma.organization.findFirst({
      where: { name: testOrgName, isActive: true },
      select: { id: true },
    })) ??
    (await prisma.organization.create({
      data: {
        name: testOrgName,
        onboardingCompleted: true,
        defaultLocale: 'ro',
        weekStart: 'MONDAY',
      },
      select: { id: true },
    }));

  await prisma.organization.update({
    where: { id: testOrganization.id },
    data: {
      name: testOrgName,
      onboardingCompleted: true,
      defaultLocale: 'ro',
      weekStart: 'MONDAY',
    },
  });

  await prisma.organizationSetting.upsert({
    where: { organizationId: testOrganization.id },
    update: { defaultLocale: 'ro', weekStart: 'MONDAY' },
    create: { organizationId: testOrganization.id, defaultLocale: 'ro', weekStart: 'MONDAY' },
  });

  const superadminPlainPassword = process.env.SUPERADMIN_PASSWORD || 'SuperAdmin123!';
  const managerPlainPassword = process.env.MANAGER_TEST_PASSWORD || 'Manager123!';
  const tenantPlainPassword = process.env.TENANT_TEST_PASSWORD || 'Tenant123!';
  const superadminPassword = await bcrypt.hash(superadminPlainPassword, 10);
  const managerPassword = await bcrypt.hash(managerPlainPassword, 10);
  const tenantPassword = await bcrypt.hash(tenantPlainPassword, 10);

  const superadminEmail = process.env.SUPERADMIN_EMAIL || 'bolboceanuigor@gmail.com';
  const managerEmail = process.env.MANAGER_TEST_EMAIL || 'manager.test@example.com';
  const tenantEmail = process.env.TENANT_TEST_EMAIL || 'tenant.test@example.com';

  const superadmin = await prisma.user.upsert({
    where: { email: superadminEmail },
    update: {
      passwordHash: superadminPassword,
      firstName: 'Igor',
      lastName: 'Bolboceanu',
      role: Role.SUPERADMIN,
      authProvider: 'LOCAL',
      emailVerifiedAt: new Date(),
      organizationId: organization.id,
      isActive: true,
      deletedAt: null,
    },
    create: {
      email: superadminEmail,
      passwordHash: superadminPassword,
      firstName: 'Igor',
      lastName: 'Bolboceanu',
      role: Role.SUPERADMIN,
      authProvider: 'LOCAL',
      emailVerifiedAt: new Date(),
      organizationId: organization.id,
      isActive: true,
    },
  });

  const superAdminV2Email = process.env.SUPER_ADMIN_V2_EMAIL || 'superadmin@condoflow.app';
  const superAdminV2Password = await bcrypt.hash(process.env.SUPER_ADMIN_V2_PASSWORD || 'SuperAdmin123!', 10);
  const superAdminV2 = await prisma.user.upsert({
    where: { email: superAdminV2Email },
    update: {
      passwordHash: superAdminV2Password,
      firstName: 'Platform',
      lastName: 'Owner',
      role: Role.SUPER_ADMIN,
      authProvider: 'LOCAL',
      emailVerifiedAt: new Date(),
      organizationId: organization.id,
      isActive: true,
      deletedAt: null,
    },
    create: {
      email: superAdminV2Email,
      passwordHash: superAdminV2Password,
      firstName: 'Platform',
      lastName: 'Owner',
      role: Role.SUPER_ADMIN,
      authProvider: 'LOCAL',
      emailVerifiedAt: new Date(),
      organizationId: organization.id,
      isActive: true,
    },
  });
  void superAdminV2;

  const manager = await prisma.user.upsert({
    where: { email: managerEmail },
    update: {
      passwordHash: managerPassword,
      firstName: 'Test',
      lastName: 'Manager',
      role: Role.MANAGER,
      authProvider: 'LOCAL',
      emailVerifiedAt: new Date(),
      organizationId: organization.id,
      isActive: true,
      deletedAt: null,
    },
    create: {
      email: managerEmail,
      passwordHash: managerPassword,
      firstName: 'Test',
      lastName: 'Manager',
      role: Role.MANAGER,
      authProvider: 'LOCAL',
      emailVerifiedAt: new Date(),
      organizationId: organization.id,
      isActive: true,
    },
  });
  const tenant = await prisma.user.upsert({
    where: { email: tenantEmail },
    update: {
      passwordHash: tenantPassword,
      firstName: 'Test',
      lastName: 'Tenant',
      role: Role.TENANT,
      authProvider: 'LOCAL',
      emailVerifiedAt: new Date(),
      organizationId: organization.id,
      isActive: true,
      deletedAt: null,
    },
    create: {
      email: tenantEmail,
      passwordHash: tenantPassword,
      firstName: 'Test',
      lastName: 'Tenant',
      role: Role.TENANT,
      authProvider: 'LOCAL',
      emailVerifiedAt: new Date(),
      organizationId: organization.id,
      isActive: true,
    },
  });

  const adminOrgAEmail = process.env.ADMIN_ORG_A_EMAIL || 'admin.a@condoflow.app';
  const adminOrgBEmail = process.env.ADMIN_ORG_B_EMAIL || 'admin.b@condoflow.app';
  const residentAEmail = process.env.RESIDENT_A_EMAIL || 'resident.a@condoflow.app';
  const residentBEmail = process.env.RESIDENT_B_EMAIL || 'resident.b@condoflow.app';
  const adminPasswordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin12345!', 10);
  const residentPasswordHash = await bcrypt.hash(process.env.RESIDENT_PASSWORD || 'Resident123!', 10);

  const adminA = await prisma.user.upsert({
    where: { email: adminOrgAEmail },
    update: {
      passwordHash: adminPasswordHash,
      firstName: 'Admin',
      lastName: 'OrgA',
      role: Role.ADMIN,
      authProvider: 'LOCAL',
      emailVerifiedAt: new Date(),
      organizationId: organization.id,
      isActive: true,
      deletedAt: null,
    },
    create: {
      email: adminOrgAEmail,
      passwordHash: adminPasswordHash,
      firstName: 'Admin',
      lastName: 'OrgA',
      role: Role.ADMIN,
      authProvider: 'LOCAL',
      emailVerifiedAt: new Date(),
      organizationId: organization.id,
      isActive: true,
    },
  });

  const adminB = await prisma.user.upsert({
    where: { email: adminOrgBEmail },
    update: {
      passwordHash: adminPasswordHash,
      firstName: 'Admin',
      lastName: 'OrgB',
      role: Role.ADMIN,
      authProvider: 'LOCAL',
      emailVerifiedAt: new Date(),
      organizationId: testOrganization.id,
      isActive: true,
      deletedAt: null,
    },
    create: {
      email: adminOrgBEmail,
      passwordHash: adminPasswordHash,
      firstName: 'Admin',
      lastName: 'OrgB',
      role: Role.ADMIN,
      authProvider: 'LOCAL',
      emailVerifiedAt: new Date(),
      organizationId: testOrganization.id,
      isActive: true,
    },
  });

  await prisma.organization.update({
    where: { id: organization.id },
    data: {
      address: 'Strada Organizatie A 1',
      status: 'ACTIVE',
      subscriptionStatus: 'ACTIVE',
      subscriptionPlan: 'PRO',
      ownerAdminId: adminA.id,
    },
  });
  await prisma.organization.update({
    where: { id: testOrganization.id },
    data: {
      address: 'Strada Organizatie B 10',
      status: 'ACTIVE',
      subscriptionStatus: 'TRIAL',
      subscriptionPlan: 'BASIC',
      ownerAdminId: adminB.id,
    },
  });

  async function seedOrgCoreData(orgId: string, adminId: string, residentEmail: string, prefix: string) {
    const buildingConfigs =
      prefix === 'ORG-A'
        ? [
            { name: 'Building A', address: 'A Street 1', totalFloors: 9, staircases: 4 },
            { name: 'Building B', address: 'B Street 12', totalFloors: 7, staircases: 2 },
          ]
        : [{ name: `${prefix} Building`, address: `${prefix} Address`, totalFloors: 6, staircases: 2 }];

    const apartmentsForProfiles: Array<{ id: string; number: string }> = [];

    for (const buildingConfig of buildingConfigs) {
      const building =
        (await prisma.building.findFirst({
          where: { organizationId: orgId, name: buildingConfig.name },
        })) ||
        (await prisma.building.create({
          data: {
            organizationId: orgId,
            name: buildingConfig.name,
            address: buildingConfig.address,
            totalFloors: buildingConfig.totalFloors,
          },
        }));

      for (let s = 1; s <= buildingConfig.staircases; s += 1) {
        const staircaseName = `Staircase ${s}`;
        const staircase =
          (await prisma.staircase.findFirst({
            where: { organizationId: orgId, buildingId: building.id, name: staircaseName },
          })) ||
          (await prisma.staircase.create({
            data: { organizationId: orgId, buildingId: building.id, name: staircaseName, floorsCount: buildingConfig.totalFloors },
          }));

        for (let floor = 1; floor <= Math.min(buildingConfig.totalFloors, 4); floor += 1) {
          const apartmentNumber = `${s}${floor}0${prefix === 'ORG-A' ? 'A' : 'B'}`;
          const apartment =
            (await prisma.apartment.findFirst({
              where: { organizationId: orgId, staircaseId: staircase.id, number: apartmentNumber },
            })) ||
            (await prisma.apartment.create({
              data: {
                organizationId: orgId,
                buildingId: building.id,
                staircaseId: staircase.id,
                number: apartmentNumber,
                floor,
                areaM2: 55 + floor * 3,
                rooms: floor % 2 === 0 ? 3 : 2,
                status: floor % 3 === 0 ? 'RENTED' : floor % 2 === 0 ? 'OCCUPIED' : 'EMPTY',
              },
            }));
          apartmentsForProfiles.push({ id: apartment.id, number: apartment.number });
        }
      }
    }

    const resident = await prisma.user.upsert({
      where: { email: residentEmail },
      update: {
        passwordHash: residentPasswordHash,
        firstName: `${prefix}Resident`,
        lastName: 'User',
        role: Role.RESIDENT,
        authProvider: 'LOCAL',
        emailVerifiedAt: new Date(),
        organizationId: orgId,
        isActive: true,
        deletedAt: null,
      },
      create: {
        email: residentEmail,
        passwordHash: residentPasswordHash,
        firstName: `${prefix}Resident`,
        lastName: 'User',
        role: Role.RESIDENT,
        authProvider: 'LOCAL',
        emailVerifiedAt: new Date(),
        organizationId: orgId,
        isActive: true,
      },
    });

    await prisma.residentProfile.upsert({
      where: { userId_apartmentId: { userId: resident.id, apartmentId: apartmentsForProfiles[0].id } },
      update: { organizationId: orgId, type: 'OWNER', phone: '+37360000001' },
      create: {
        userId: resident.id,
        apartmentId: apartmentsForProfiles[0].id,
        organizationId: orgId,
        type: 'OWNER',
        phone: '+37360000001',
      },
    });

    // Resident owning multiple apartments
    if (apartmentsForProfiles[1]) {
      await prisma.residentProfile.upsert({
        where: { userId_apartmentId: { userId: resident.id, apartmentId: apartmentsForProfiles[1].id } },
        update: { organizationId: orgId, type: 'OWNER', phone: '+37360000001' },
        create: {
          userId: resident.id,
          apartmentId: apartmentsForProfiles[1].id,
          organizationId: orgId,
          type: 'OWNER',
          phone: '+37360000001',
        },
      });
    }

    await prisma.payment.deleteMany({
      where: { organizationId: orgId, apartmentId: apartmentsForProfiles[0].id, month: { in: ['2026-03', '2026-04'] } },
    });
    await prisma.payment.createMany({
      data: [
        {
          organizationId: orgId,
          apartmentId: apartmentsForProfiles[0].id,
          amount: 1200,
          status: 'CONFIRMED',
          month: '2026-03',
          currency: 'MDL',
          method: 'BANK_TRANSFER',
          provider: 'MANUAL_BANK_TRANSFER',
        },
        {
          organizationId: orgId,
          apartmentId: apartmentsForProfiles[0].id,
          amount: 1300,
          status: 'PENDING',
          month: '2026-04',
          currency: 'MDL',
          method: 'CASH',
          provider: 'CASH',
        },
      ],
      skipDuplicates: false,
    });

    await prisma.announcement.deleteMany({
      where: { organizationId: orgId, title: `${prefix} Maintenance Notice` },
    });
    await prisma.announcement.createMany({
      data: [
        {
          organizationId: orgId,
          title: `${prefix} Maintenance Notice`,
          content: 'Scheduled maintenance this weekend.',
          importance: 'NORMAL',
          targetType: 'ORGANIZATION',
          createdByUserId: adminId,
        },
      ],
      skipDuplicates: false,
    });

    await prisma.issue.deleteMany({
      where: { organizationId: orgId, title: { in: [`${prefix} Water leakage report`, `${prefix} Elevator audit`] } },
    });
    await prisma.issue.createMany({
      data: [
        {
          organizationId: orgId,
          apartmentId: apartmentsForProfiles[0].id,
          createdByUserId: resident.id,
          title: `${prefix} Water leakage report`,
          description: 'Water leakage near bathroom sink.',
          category: 'WATER',
          locationType: 'APARTMENT',
          status: 'NEW',
          priority: 'HIGH',
        },
        {
          organizationId: orgId,
          apartmentId: apartmentsForProfiles[0].id,
          createdByUserId: adminId,
          title: `${prefix} Elevator audit`,
          description: 'Resident reported elevator intermittent stops.',
          category: 'ELEVATOR',
          locationType: 'BUILDING',
          status: 'IN_PROGRESS',
          priority: 'MEDIUM',
        },
      ],
      skipDuplicates: false,
    });
  }

  await seedOrgCoreData(organization.id, adminA.id, residentAEmail, 'ORG-A');
  await seedOrgCoreData(testOrganization.id, adminB.id, residentBEmail, 'ORG-B');

  const [planPerApartment, planPerM2, planFixed] = await Promise.all([
    prisma.subscriptionPlan.upsert({
      where: { id: '11111111-1111-1111-1111-111111111111' },
      update: {
        name: 'Per apartment',
        description: 'Contract billed per apartment',
        defaultBillingType: 'PER_APARTMENT',
        defaultPrice: 1,
        currency: 'MDL',
        isActive: true,
      },
      create: {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Per apartment',
        description: 'Contract billed per apartment',
        defaultBillingType: 'PER_APARTMENT',
        defaultPrice: 1,
        currency: 'MDL',
        isActive: true,
      },
    }),
    prisma.subscriptionPlan.upsert({
      where: { id: '22222222-2222-2222-2222-222222222222' },
      update: {
        name: 'Per m2',
        description: 'Contract billed per square meter',
        defaultBillingType: 'PER_M2',
        defaultPrice: 0.1,
        currency: 'MDL',
        isActive: true,
      },
      create: {
        id: '22222222-2222-2222-2222-222222222222',
        name: 'Per m2',
        description: 'Contract billed per square meter',
        defaultBillingType: 'PER_M2',
        defaultPrice: 0.1,
        currency: 'MDL',
        isActive: true,
      },
    }),
    prisma.subscriptionPlan.upsert({
      where: { id: '33333333-3333-3333-3333-333333333333' },
      update: {
        name: 'Fixed',
        description: 'Fixed monthly contract',
        defaultBillingType: 'FIXED',
        defaultPrice: 100,
        currency: 'MDL',
        isActive: true,
      },
      create: {
        id: '33333333-3333-3333-3333-333333333333',
        name: 'Fixed',
        description: 'Fixed monthly contract',
        defaultBillingType: 'FIXED',
        defaultPrice: 100,
        currency: 'MDL',
        isActive: true,
      },
    }),
  ]);
  void planFixed;
  const trialStartDate = new Date();
  const trialEndDate = addDays(trialStartDate, 30);
  await prisma.organizationSubscription.upsert({
    where: { organizationId: organization.id },
    update: {
      planId: planPerApartment.id,
      billingType: 'PER_APARTMENT',
      price: 1,
      currency: 'MDL',
      trialStartDate,
      trialEndDate,
      subscriptionStartDate: null,
      nextBillingDate: trialEndDate,
      status: 'TRIAL',
      notes: '1 month free trial',
    },
    create: {
      organizationId: organization.id,
      planId: planPerApartment.id,
      billingType: 'PER_APARTMENT',
      price: 1,
      currency: 'MDL',
      trialStartDate,
      trialEndDate,
      subscriptionStartDate: null,
      nextBillingDate: trialEndDate,
      status: 'TRIAL',
      notes: '1 month free trial',
    },
  });
  await prisma.organizationSubscription.upsert({
    where: { organizationId: testOrganization.id },
    update: {
      planId: planPerM2.id,
      billingType: 'PER_M2',
      price: 0.1,
      currency: 'MDL',
      trialStartDate: null,
      trialEndDate: null,
      subscriptionStartDate: trialStartDate,
      nextBillingDate: addDays(trialStartDate, 30),
      status: 'ACTIVE',
      notes: 'Custom per m2 contract',
    },
    create: {
      organizationId: testOrganization.id,
      planId: planPerM2.id,
      billingType: 'PER_M2',
      price: 0.1,
      currency: 'MDL',
      trialStartDate: null,
      trialEndDate: null,
      subscriptionStartDate: trialStartDate,
      nextBillingDate: addDays(trialStartDate, 30),
      status: 'ACTIVE',
      notes: 'Custom per m2 contract',
    },
  });

  const [freePlan, trialPlan, starterPlan, proPlan] = await Promise.all([
    prisma.plan.upsert({
      where: { code: PlanCode.FREE },
      update: { name: 'Free', priceMonthly: 0, currency: 'EUR' },
      create: { code: PlanCode.FREE, name: 'Free', priceMonthly: 0, currency: 'EUR' },
    }),
    prisma.plan.upsert({
      where: { code: PlanCode.TRIAL },
      update: { name: 'Trial', priceMonthly: 0, currency: 'EUR' },
      create: { code: PlanCode.TRIAL, name: 'Trial', priceMonthly: 0, currency: 'EUR' },
    }),
    prisma.plan.upsert({
      where: { code: PlanCode.STARTER },
      update: { name: 'Starter', priceMonthly: 29, currency: 'EUR' },
      create: { code: PlanCode.STARTER, name: 'Starter', priceMonthly: 29, currency: 'EUR' },
    }),
    prisma.plan.upsert({
      where: { code: PlanCode.PRO },
      update: { name: 'Pro', priceMonthly: 79, currency: 'EUR' },
      create: { code: PlanCode.PRO, name: 'Pro', priceMonthly: 79, currency: 'EUR' },
    }),
  ]);
  void freePlan;
  void trialPlan;
  void starterPlan;
  await prisma.subscription.upsert({
    where: { organizationId: organization.id },
    update: {
      planId: proPlan.id,
      plan: 'pro',
      status: 'ACTIVE',
      currentPeriodStart: new Date(),
      currentPeriodEnd: addDays(new Date(), 30),
      propertyLimit: 1000,
      trialEndsAt: addDays(new Date(), 30),
    },
    create: {
      organizationId: organization.id,
      planId: proPlan.id,
      plan: 'pro',
      status: 'ACTIVE',
      currentPeriodStart: new Date(),
      currentPeriodEnd: addDays(new Date(), 30),
      propertyLimit: 1000,
      trialEndsAt: addDays(new Date(), 30),
    },
  });

  const propertyInputs = [
    { name: 'Apt 01', code: '01' },
    { name: 'Apt 02', code: '02' },
    { name: 'Apt 03', code: '03' },
    { name: 'Apt 04', code: '04' },
    { name: 'Apt 05', code: '05' },
    { name: 'Apt 06', code: '06' },
  ];
  const testOrgPropertyInputs = [
    { name: 'Test Apt 01', code: 'T01' },
    { name: 'Test Apt 02', code: 'T02' },
    { name: 'Test Apt 03', code: 'T03' },
  ];

  const properties: Array<{ id: string; name: string; code: string | null }> = [];
  for (const input of propertyInputs) {
    const existingProperty = await prisma.property.findFirst({
      where: {
        organizationId: organization.id,
        deletedAt: null,
        code: input.code,
      },
      select: { id: true, name: true, code: true },
    });
    if (existingProperty) {
      const updated = await prisma.property.update({
        where: { id: existingProperty.id },
        data: {
          name: input.name,
          isActive: true,
          address: `Street ${input.code}`,
          ownerId: superadmin.id,
          status: 'active',
          basePrice: 100,
          cleaningFee: 20,
          rooms: 2,
          numberOfRooms: 2,
          cleaningPrice: 20,
          deletedAt: null,
        },
        select: { id: true, name: true, code: true },
      });
      properties.push(updated);
    } else {
      const created = await prisma.property.create({
        data: {
          name: input.name,
          code: input.code,
          isActive: true,
          address: `Street ${input.code}`,
          organizationId: organization.id,
          ownerId: superadmin.id,
          basePrice: 100,
          cleaningFee: 20,
          rooms: 2,
          numberOfRooms: 2,
          cleaningPrice: 20,
          status: 'active',
        },
        select: { id: true, name: true, code: true },
      });
      properties.push(created);
    }
  }

  const testOrgProperties: Array<{ id: string; name: string; code: string | null }> = [];
  for (const input of testOrgPropertyInputs) {
    const existingProperty = await prisma.property.findFirst({
      where: {
        organizationId: testOrganization.id,
        deletedAt: null,
        code: input.code,
      },
      select: { id: true, name: true, code: true },
    });
    if (existingProperty) {
      const updated = await prisma.property.update({
        where: { id: existingProperty.id },
        data: {
          name: input.name,
          isActive: true,
          address: `Street ${input.code}`,
          ownerId: superadmin.id,
          status: 'active',
          basePrice: 100,
          cleaningFee: 20,
          rooms: 2,
          numberOfRooms: 2,
          cleaningPrice: 20,
          deletedAt: null,
        },
        select: { id: true, name: true, code: true },
      });
      testOrgProperties.push(updated);
    } else {
      const created = await prisma.property.create({
        data: {
          name: input.name,
          code: input.code,
          isActive: true,
          address: `Street ${input.code}`,
          organizationId: testOrganization.id,
          ownerId: superadmin.id,
          basePrice: 100,
          cleaningFee: 20,
          rooms: 2,
          numberOfRooms: 2,
          cleaningPrice: 20,
          status: 'active',
        },
        select: { id: true, name: true, code: true },
      });
      testOrgProperties.push(created);
    }
  }

  if (seedDemo) {
    const assignedToManager = properties.slice(0, 3);
    const assignedToTenant = properties.slice(0, 1);
    await prisma.propertyAccess.deleteMany({ where: { userId: manager.id, organizationId: organization.id } });
    await prisma.propertyAccess.deleteMany({ where: { userId: tenant.id, organizationId: organization.id } });
    for (const property of assignedToManager) {
      await prisma.propertyAccess.upsert({
        where: {
          organizationId_userId_propertyId: {
            organizationId: organization.id,
            userId: manager.id,
            propertyId: property.id,
          },
        },
        update: {},
        create: {
          organizationId: organization.id,
          userId: manager.id,
          propertyId: property.id,
        },
      });
    }
    for (const property of assignedToTenant) {
      await prisma.propertyAccess.upsert({
        where: {
          organizationId_userId_propertyId: {
            organizationId: organization.id,
            userId: tenant.id,
            propertyId: property.id,
          },
        },
        update: {},
        create: {
          organizationId: organization.id,
          userId: tenant.id,
          propertyId: property.id,
        },
      });
    }
  }

  const building = await (prisma as any).condoBuilding.upsert({
    where: {
      id:
        (
          await (prisma as any).condoBuilding.findFirst({
            where: { organizationId: organization.id, name: 'Bloc Central A' },
            select: { id: true },
          })
        )?.id || '00000000-0000-0000-0000-000000000000',
    },
    update: {
      name: 'Bloc Central A',
      address: 'Str. Stefan cel Mare 10',
      cadastreStatus: 'PENDING',
      totalUnits: 24,
    },
    create: {
      organizationId: organization.id,
      name: 'Bloc Central A',
      address: 'Str. Stefan cel Mare 10',
      cadastreStatus: 'PENDING',
      totalUnits: 24,
    },
  }).catch(async () => {
    return (prisma as any).condoBuilding.findFirstOrThrow({
      where: { organizationId: organization.id, name: 'Bloc Central A' },
    });
  });

  await (prisma as any).condoUnit.upsert({
    where: {
      buildingId_number: {
        buildingId: building.id,
        number: '12',
      },
    },
    update: {
      ownerUserId: tenant.id,
      monthlyFeeMdl: 550,
      repairFundMdl: 1200,
      debtMdl: 150,
      floor: '3',
      areaSqm: 67,
    },
    create: {
      organizationId: organization.id,
      buildingId: building.id,
      number: '12',
      floor: '3',
      areaSqm: 67,
      ownerUserId: tenant.id,
      monthlyFeeMdl: 550,
      repairFundMdl: 1200,
      debtMdl: 150,
    },
  });

  await (prisma as any).annualSummary.upsert({
    where: { organizationId_year: { organizationId: organization.id, year: new Date().getFullYear() - 1 } },
    update: {
      status: 'PUBLISHED',
      adminName: 'Igor Bolboceanu',
      totalBudgetMdl: 285000,
      totalExpensesMdl: 262500,
      repairFundMdl: 55800,
      debtTotalMdl: 13100,
      notes: 'Raport anual publicat pentru transparenta proprietarilor.',
      publishedAt: new Date(),
      createdById: superadmin.id,
    },
    create: {
      organizationId: organization.id,
      year: new Date().getFullYear() - 1,
      status: 'PUBLISHED',
      adminName: 'Igor Bolboceanu',
      totalBudgetMdl: 285000,
      totalExpensesMdl: 262500,
      repairFundMdl: 55800,
      debtTotalMdl: 13100,
      notes: 'Raport anual publicat pentru transparenta proprietarilor.',
      publishedAt: new Date(),
      createdById: superadmin.id,
    },
  });

  await (prisma as any).condoAnnouncement.deleteMany({
    where: {
      organizationId: organization.id,
      title: { in: ['Sedinta asociatie - convocare', 'Fond reparatii'] },
    },
  });
  await (prisma as any).condoAnnouncement.createMany({
    data: [
      {
        organizationId: organization.id,
        title: 'Sedinta asociatie - convocare',
        body: 'Sedinta are loc marti la 19:00, sala parter. Agenda: buget, reparatii, vot online.',
        visibility: 'OWNERS',
        createdById: superadmin.id,
      },
      {
        organizationId: organization.id,
        title: 'Fond reparatii',
        body: 'Contributia lunara la fondul de reparatii ramane 120 MDL/apartament.',
        visibility: 'OWNERS',
        createdById: superadmin.id,
      },
    ],
    skipDuplicates: false,
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const reservations: Array<{
    property: (typeof properties)[number];
    guest: string;
    startOffset: number;
    endOffset: number;
    status: ReservationStatus;
    source: string;
  }> = [
    // starts before typical range and ends inside it
    { property: properties[0], guest: 'Alice PreRange', startOffset: -3, endOffset: 2, status: ReservationStatus.CONFIRMED, source: 'AIRBNB' },
    { property: properties[0], guest: 'Bob Lane', startOffset: 1, endOffset: 5, status: ReservationStatus.PENDING, source: 'BOOKING' },
    { property: properties[1], guest: 'Charlie Direct', startOffset: 4, endOffset: 9, status: ReservationStatus.CONFIRMED, source: 'DIRECT' },
    { property: properties[1], guest: 'Delta Overlap', startOffset: 6, endOffset: 11, status: ReservationStatus.BLOCKED, source: 'DIRECT' },
    { property: properties[2], guest: 'Echo Cancelled', startOffset: 8, endOffset: 10, status: ReservationStatus.CANCELLED, source: 'AIRBNB' },
    { property: properties[3], guest: 'Foxtrot', startOffset: 3, endOffset: 8, status: ReservationStatus.CONFIRMED, source: 'BOOKING' },
    { property: properties[4], guest: 'Golf', startOffset: 12, endOffset: 16, status: ReservationStatus.PENDING, source: 'DIRECT' },
    { property: properties[5], guest: 'Hotel', startOffset: 14, endOffset: 20, status: ReservationStatus.CONFIRMED, source: 'AIRBNB' },
  ];

  if (seedDemo) {
    const existingReservations = await prisma.reservation.count({
      where: { organizationId: organization.id, deletedAt: null },
    });
    if (existingReservations === 0) {
      for (const reservation of reservations) {
        await prisma.reservation.create({
          data: {
            organizationId: organization.id,
            propertyId: reservation.property.id,
            guestName: reservation.guest,
            phoneNumber: null,
            checkIn: addDays(today, reservation.startOffset),
            checkOut: addDays(today, reservation.endOffset),
            totalPrice: 250,
            status: reservation.status,
            source: reservation.source,
            notes: 'Seeded reservation',
            cleaningStatus: 'TODO',
          },
        });
      }
    }
  }

  if (seedDemo) {
    const testOrgReservations = await prisma.reservation.count({
      where: { organizationId: testOrganization.id, deletedAt: null },
    });
    if (testOrgReservations === 0) {
      const testReservations = [
        { property: testOrgProperties[0], guest: 'Test Org Guest 1', startOffset: 2, endOffset: 6, status: ReservationStatus.CONFIRMED, source: 'DIRECT' },
        { property: testOrgProperties[1], guest: 'Test Org Guest 2', startOffset: 8, endOffset: 12, status: ReservationStatus.PENDING, source: 'BOOKING' },
      ];
      for (const reservation of testReservations) {
        await prisma.reservation.create({
          data: {
            organizationId: testOrganization.id,
            propertyId: reservation.property.id,
            guestName: reservation.guest,
            phoneNumber: null,
            checkIn: addDays(today, reservation.startOffset),
            checkOut: addDays(today, reservation.endOffset),
            totalPrice: 180,
            status: reservation.status,
            source: reservation.source,
            notes: 'Seeded reservation (Test Org)',
            cleaningStatus: 'TODO',
          },
        });
      }
    }
  }

  const demoOrgName = 'Demo Asociație Centrală';
  const demoOrg =
    (await prisma.organization.findFirst({
      where: { name: demoOrgName },
      select: { id: true },
    })) ??
    (await prisma.organization.create({
      data: {
        name: demoOrgName,
        isActive: true,
        isDemo: true,
        betaAccessEnabled: true,
        onboardingCompleted: true,
        onboardingStatus: 'COMPLETED',
        defaultLocale: 'ro',
        weekStart: 'MONDAY',
      },
      select: { id: true },
    }));

  await prisma.organization.update({
    where: { id: demoOrg.id },
    data: {
      isActive: true,
      isDemo: true,
      betaAccessEnabled: true,
      onboardingCompleted: true,
      onboardingStatus: 'COMPLETED',
      address: 'Chișinău, Str. Demo 25',
    },
  });

  await prisma.organizationSetting.upsert({
    where: { organizationId: demoOrg.id },
    update: { defaultLocale: 'ro', weekStart: 'MONDAY' },
    create: { organizationId: demoOrg.id, defaultLocale: 'ro', weekStart: 'MONDAY' },
  });

  const demoAdminPasswordPlain = process.env.DEMO_ADMIN_PASSWORD || 'DemoAdmin123!';
  const demoAdminPasswordHash = await bcrypt.hash(demoAdminPasswordPlain, 10);
  const demoAdminEmail = process.env.DEMO_ADMIN_EMAIL || 'demo.admin@condoflow.app';
  const demoAdmin = await prisma.user.upsert({
    where: { email: demoAdminEmail },
    update: {
      passwordHash: demoAdminPasswordHash,
      firstName: 'Demo',
      lastName: 'Administrator',
      role: Role.ADMIN,
      authProvider: 'LOCAL',
      emailVerifiedAt: new Date(),
      organizationId: demoOrg.id,
      isActive: true,
      isDemoUser: true,
      deletedAt: null,
    },
    create: {
      email: demoAdminEmail,
      passwordHash: demoAdminPasswordHash,
      firstName: 'Demo',
      lastName: 'Administrator',
      role: Role.ADMIN,
      authProvider: 'LOCAL',
      emailVerifiedAt: new Date(),
      organizationId: demoOrg.id,
      isActive: true,
      isDemoUser: true,
    },
  });

  const demoBuildings = [
    { name: 'Bloc Demo A', address: 'Str. Demo A 1', floors: 10, staircases: 2 },
    { name: 'Bloc Demo B', address: 'Str. Demo B 8', floors: 8, staircases: 2 },
  ];
  const demoApartments: Array<{ id: string; number: string; buildingId: string; staircaseId: string }> = [];

  for (const block of demoBuildings) {
    const building =
      (await prisma.building.findFirst({
        where: { organizationId: demoOrg.id, name: block.name },
      })) ||
      (await prisma.building.create({
        data: {
          organizationId: demoOrg.id,
          name: block.name,
          address: block.address,
          totalFloors: block.floors,
        },
      }));

    for (let s = 1; s <= block.staircases; s += 1) {
      const staircaseName = `Scara ${s}`;
      const staircase =
        (await prisma.staircase.findFirst({
          where: { organizationId: demoOrg.id, buildingId: building.id, name: staircaseName },
        })) ||
        (await prisma.staircase.create({
          data: { organizationId: demoOrg.id, buildingId: building.id, name: staircaseName, floorsCount: block.floors },
        }));

      for (let i = 1; i <= 13; i += 1) {
        if (demoApartments.length >= 50) break;
        const number = `${s}${String(i).padStart(2, '0')}`;
        const apartment =
          (await prisma.apartment.findFirst({
            where: { organizationId: demoOrg.id, staircaseId: staircase.id, number },
          })) ||
          (await prisma.apartment.create({
            data: {
              organizationId: demoOrg.id,
              buildingId: building.id,
              staircaseId: staircase.id,
              number,
              floor: Math.max(1, Math.ceil(i / 2)),
              areaM2: 42 + i,
              rooms: i % 2 === 0 ? 3 : 2,
              status: i % 5 === 0 ? 'EMPTY' : 'OCCUPIED',
            },
          }));
        demoApartments.push({ id: apartment.id, number: apartment.number, buildingId: building.id, staircaseId: staircase.id });
      }
    }
  }

  const demoResidentPasswordHash = await bcrypt.hash(process.env.DEMO_RESIDENT_PASSWORD || 'DemoResident123!', 10);
  for (let i = 1; i <= 12; i += 1) {
    const email = `demo.resident${i}@condoflow.app`;
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        passwordHash: demoResidentPasswordHash,
        firstName: `Locatar`,
        lastName: `Demo ${i}`,
        role: Role.RESIDENT,
        authProvider: 'LOCAL',
        emailVerifiedAt: new Date(),
        organizationId: demoOrg.id,
        isActive: true,
        isDemoUser: true,
        deletedAt: null,
      },
      create: {
        email,
        passwordHash: demoResidentPasswordHash,
        firstName: 'Locatar',
        lastName: `Demo ${i}`,
        role: Role.RESIDENT,
        authProvider: 'LOCAL',
        emailVerifiedAt: new Date(),
        organizationId: demoOrg.id,
        isActive: true,
        isDemoUser: true,
      },
    });
    const apartment = demoApartments[(i - 1) % demoApartments.length];
    await prisma.residentProfile.upsert({
      where: { userId_apartmentId: { userId: user.id, apartmentId: apartment.id } },
      update: { organizationId: demoOrg.id, type: 'OWNER', phone: `+37360010${String(i).padStart(2, '0')}` },
      create: {
        userId: user.id,
        apartmentId: apartment.id,
        organizationId: demoOrg.id,
        type: 'OWNER',
        phone: `+37360010${String(i).padStart(2, '0')}`,
      },
    });
  }

  const now = new Date();
  for (let i = 0; i < Math.min(20, demoApartments.length); i += 1) {
    const apartment = demoApartments[i];
    const invoiceNumber = `DEMO-${now.getFullYear()}-${String(i + 1).padStart(4, '0')}`;
    const residentInvoice =
      (await prisma.residentInvoice.findFirst({
        where: { invoiceNumber },
        select: { id: true },
      })) ||
      (await prisma.residentInvoice.create({
        data: {
          organizationId: demoOrg.id,
          apartmentId: apartment.id,
          month: now.getMonth() + 1,
          year: now.getFullYear(),
          invoiceNumber,
          previousDebt: i % 3 === 0 ? 220 : 0,
          currentCharges: 650 + i * 7,
          paymentsAmount: i % 4 === 0 ? 300 : 0,
          totalDue: 650 + i * 7 + (i % 3 === 0 ? 220 : 0) - (i % 4 === 0 ? 300 : 0),
          status: i % 5 === 0 ? 'ISSUED' : 'DRAFT',
          dueDate: addDays(now, 10),
          issuedAt: addDays(now, -3),
        },
      }));

    await prisma.payment.upsert({
      where: { id: `demo-payment-${i}` },
      update: {
        organizationId: demoOrg.id,
        apartmentId: apartment.id,
        invoiceId: residentInvoice.id,
        amount: 150 + i * 5,
        status: i % 2 === 0 ? 'CONFIRMED' : 'PENDING',
        month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
        currency: 'MDL',
        method: 'BANK_TRANSFER',
        provider: 'MANUAL_BANK_TRANSFER',
      },
      create: {
        id: `demo-payment-${i}`,
        organizationId: demoOrg.id,
        apartmentId: apartment.id,
        invoiceId: residentInvoice.id,
        amount: 150 + i * 5,
        status: i % 2 === 0 ? 'CONFIRMED' : 'PENDING',
        month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
        currency: 'MDL',
        method: 'BANK_TRANSFER',
        provider: 'MANUAL_BANK_TRANSFER',
      },
    });
  }

  await prisma.issue.createMany({
    data: [
      {
        organizationId: demoOrg.id,
        apartmentId: demoApartments[0]?.id,
        createdByUserId: demoAdmin.id,
        title: 'Demo: iluminat pe casa scării',
        description: 'Bec ars la etajul 4. Date demonstrative.',
        category: 'ELECTRICITY',
        locationType: 'STAIRCASE',
        status: 'NEW',
        priority: 'MEDIUM',
      },
      {
        organizationId: demoOrg.id,
        apartmentId: demoApartments[1]?.id,
        createdByUserId: demoAdmin.id,
        title: 'Demo: presiune apă scăzută',
        description: 'Sesizare exemplu pentru testare flux.',
        category: 'WATER',
        locationType: 'BUILDING',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
      },
    ],
    skipDuplicates: true,
  });

  await prisma.announcement.createMany({
    data: [
      {
        organizationId: demoOrg.id,
        title: 'ANUNȚ DEMO: Curățenie generală',
        content: 'Acest anunț este parte din datele demonstrative.',
        importance: 'IMPORTANT',
        targetType: 'ORGANIZATION',
        createdByUserId: demoAdmin.id,
      },
      {
        organizationId: demoOrg.id,
        title: 'ANUNȚ DEMO: Revizie lift',
        content: 'Date exemplu pentru evaluare platformă.',
        importance: 'NORMAL',
        targetType: 'ORGANIZATION',
        createdByUserId: demoAdmin.id,
      },
    ],
    skipDuplicates: true,
  });

  const voteSession = await prisma.voteSession.create({
    data: {
      organizationId: demoOrg.id,
      title: 'Vot demo: modernizare interfon',
      description: 'Sesiune demonstrativă',
      targetType: 'ORGANIZATION',
      votingMethod: 'BY_APARTMENT',
      status: 'ACTIVE',
      startsAt: addDays(now, -2),
      endsAt: addDays(now, 5),
      createdByUserId: demoAdmin.id,
    },
  });
  await prisma.voteOption.createMany({
    data: [
      { voteSessionId: voteSession.id, label: 'Da' },
      { voteSessionId: voteSession.id, label: 'Nu' },
    ],
    skipDuplicates: true,
  });

  await (prisma as any).annualSummary.upsert({
    where: { organizationId_year: { organizationId: demoOrg.id, year: now.getFullYear() - 1 } },
    update: {
      status: 'PUBLISHED',
      adminName: 'Administrator Demo',
      totalBudgetMdl: 520000,
      totalExpensesMdl: 488000,
      repairFundMdl: 92000,
      debtTotalMdl: 23000,
      notes: 'Raport demonstrativ',
      publishedAt: now,
      createdById: demoAdmin.id,
    },
    create: {
      organizationId: demoOrg.id,
      year: now.getFullYear() - 1,
      status: 'PUBLISHED',
      adminName: 'Administrator Demo',
      totalBudgetMdl: 520000,
      totalExpensesMdl: 488000,
      repairFundMdl: 92000,
      debtTotalMdl: 23000,
      notes: 'Raport demonstrativ',
      publishedAt: now,
      createdById: demoAdmin.id,
    },
  });

  console.log('Seed completed successfully');
  console.log(`Superadmin: ${superadminEmail} / ${superadminPlainPassword}`);
  console.log(`Manager: ${managerEmail} / ${managerPlainPassword}`);
  console.log(`Tenant: ${tenantEmail} / ${tenantPlainPassword}`);
  console.log(`Demo admin: ${demoAdminEmail} / ${demoAdminPasswordPlain}`);
  console.log('Created 2 orgs (Espace HQ + Test Org), seeded properties/reservations plus condo owner dashboard data');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
