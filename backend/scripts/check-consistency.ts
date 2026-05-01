import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const [reservationOrgMismatches, cleaningOrgMismatches] = await Promise.all([
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM reservations r
      JOIN properties p ON p.id = r."propertyId"
      WHERE r."organizationId" <> p."organizationId"
    `,
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM cleanings c
      JOIN properties p ON p.id = c."propertyId"
      WHERE c."organizationId" <> p."organizationId"
    `,
  ]);

  const checks = [
    { label: 'reservationOrgMismatches', value: Number(reservationOrgMismatches[0]?.count ?? 0) },
    { label: 'cleaningOrgMismatches', value: Number(cleaningOrgMismatches[0]?.count ?? 0) },
  ];

  const hasIssues = checks.some((entry) => entry.value > 0);
  console.log(JSON.stringify({ ok: !hasIssues, checks }, null, 2));

  if (hasIssues) {
    process.exitCode = 1;
  }
}

run()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
