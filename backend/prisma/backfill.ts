import { PrismaClient } from '@prisma/client';
import {
  DEFAULT_BRAND_ID,
  DEFAULT_LOCAL_ID,
  DEFAULT_BRAND_SUBDOMAIN,
  PLATFORM_ADMIN_EMAILS,
} from '../src/tenancy/tenant.constants';
import { buildBrandConfigFromEnv, buildLocationConfigFromEnv } from '../src/tenancy/tenant-config.defaults';

const prisma = new PrismaClient();

async function ensureBrandAndLocation() {
  await prisma.brand.upsert({
    where: { id: DEFAULT_BRAND_ID },
    update: {
      name: 'LeBlond',
      isActive: true,
      subdomain: DEFAULT_BRAND_SUBDOMAIN,
      defaultLocationId: DEFAULT_LOCAL_ID,
    },
    create: {
      id: DEFAULT_BRAND_ID,
      name: 'LeBlond',
      subdomain: DEFAULT_BRAND_SUBDOMAIN,
      defaultLocationId: DEFAULT_LOCAL_ID,
      isActive: true,
      locations: {
        create: {
          id: DEFAULT_LOCAL_ID,
          name: 'LeBlond',
          slug: DEFAULT_BRAND_SUBDOMAIN,
          isActive: true,
        },
      },
    },
  });

  await prisma.location.upsert({
    where: { id: DEFAULT_LOCAL_ID },
    update: { name: 'LeBlond', slug: DEFAULT_BRAND_SUBDOMAIN, isActive: true, brandId: DEFAULT_BRAND_ID },
    create: {
      id: DEFAULT_LOCAL_ID,
      name: 'LeBlond',
      slug: DEFAULT_BRAND_SUBDOMAIN,
      isActive: true,
      brandId: DEFAULT_BRAND_ID,
    },
  });

  await prisma.brandConfig.upsert({
    where: { brandId: DEFAULT_BRAND_ID },
    update: { data: buildBrandConfigFromEnv() },
    create: { brandId: DEFAULT_BRAND_ID, data: buildBrandConfigFromEnv() },
  });

  await prisma.locationConfig.upsert({
    where: { localId: DEFAULT_LOCAL_ID },
    update: { data: buildLocationConfigFromEnv() },
    create: { localId: DEFAULT_LOCAL_ID, data: buildLocationConfigFromEnv() },
  });
}

async function backfillLocalId() {
  const updates = [
    prisma.$executeRaw`UPDATE \`AdminRole\` SET \`localId\` = ${DEFAULT_LOCAL_ID} WHERE \`localId\` IS NULL`,
    prisma.$executeRaw`UPDATE \`Barber\` SET \`localId\` = ${DEFAULT_LOCAL_ID} WHERE \`localId\` IS NULL`,
    prisma.$executeRaw`UPDATE \`Service\` SET \`localId\` = ${DEFAULT_LOCAL_ID} WHERE \`localId\` IS NULL`,
    prisma.$executeRaw`UPDATE \`Appointment\` SET \`localId\` = ${DEFAULT_LOCAL_ID} WHERE \`localId\` IS NULL`,
    prisma.$executeRaw`UPDATE \`Alert\` SET \`localId\` = ${DEFAULT_LOCAL_ID} WHERE \`localId\` IS NULL`,
    prisma.$executeRaw`UPDATE \`GeneralHoliday\` SET \`localId\` = ${DEFAULT_LOCAL_ID} WHERE \`localId\` IS NULL`,
    prisma.$executeRaw`UPDATE \`BarberHoliday\` SET \`localId\` = ${DEFAULT_LOCAL_ID} WHERE \`localId\` IS NULL`,
    prisma.$executeRaw`UPDATE \`ShopSchedule\` SET \`localId\` = ${DEFAULT_LOCAL_ID} WHERE \`localId\` IS NULL`,
    prisma.$executeRaw`UPDATE \`SiteSettings\` SET \`localId\` = ${DEFAULT_LOCAL_ID} WHERE \`localId\` IS NULL`,
    prisma.$executeRaw`UPDATE \`BarberSchedule\` SET \`localId\` = ${DEFAULT_LOCAL_ID} WHERE \`localId\` IS NULL`,
    prisma.$executeRaw`UPDATE \`ServiceCategory\` SET \`localId\` = ${DEFAULT_LOCAL_ID} WHERE \`localId\` IS NULL`,
    prisma.$executeRaw`UPDATE \`Offer\` SET \`localId\` = ${DEFAULT_LOCAL_ID} WHERE \`localId\` IS NULL`,
    prisma.$executeRaw`UPDATE \`ai_chat_sessions\` SET \`local_id\` = ${DEFAULT_LOCAL_ID} WHERE \`local_id\` IS NULL`,
    prisma.$executeRaw`UPDATE \`ai_chat_messages\` SET \`local_id\` = ${DEFAULT_LOCAL_ID} WHERE \`local_id\` IS NULL`,
    prisma.$executeRaw`UPDATE \`ai_business_facts\` SET \`local_id\` = ${DEFAULT_LOCAL_ID} WHERE \`local_id\` IS NULL`,
  ];

  await Promise.all(updates);
}

async function backfillBrandMemberships() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, isSuperAdmin: true, adminRoleId: true },
  });

  for (const user of users) {
    await prisma.user.update({
      where: { id: user.id },
      data: { isPlatformAdmin: PLATFORM_ADMIN_EMAILS.includes(user.email.toLowerCase()) },
    });
    await prisma.brandUser.upsert({
      where: { brandId_userId: { brandId: DEFAULT_BRAND_ID, userId: user.id } },
      update: {},
      create: { brandId: DEFAULT_BRAND_ID, userId: user.id },
    });

    if (user.role === 'admin' || user.isSuperAdmin) {
      await prisma.locationStaff.upsert({
        where: { localId_userId: { localId: DEFAULT_LOCAL_ID, userId: user.id } },
        update: { adminRoleId: user.adminRoleId ?? null },
        create: {
          localId: DEFAULT_LOCAL_ID,
          userId: user.id,
          adminRoleId: user.adminRoleId ?? null,
        },
      });
    }
  }
}

async function removeFirebaseWebConfig() {
  const configs = await prisma.brandConfig.findMany({
    select: { id: true, data: true },
  });

  for (const config of configs) {
    if (!config.data || typeof config.data !== 'object' || Array.isArray(config.data)) {
      continue;
    }
    if (!('firebaseWeb' in config.data)) {
      continue;
    }
    const next = { ...(config.data as Record<string, unknown>) };
    delete next.firebaseWeb;
    await prisma.brandConfig.update({
      where: { id: config.id },
      data: { data: next as any },
    });
  }
}

async function main() {
  console.log('Backfilling multi-tenant data...');
  await ensureBrandAndLocation();
  await removeFirebaseWebConfig();
  await backfillLocalId();
  await backfillBrandMemberships();
  console.log('Backfill complete');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
