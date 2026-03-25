import { once } from 'node:events';
import net from 'node:net';
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..', '..');
const nodeBin = process.execPath;

const STARTUP_TIMEOUT_MS = 45_000;
const REQUEST_TIMEOUT_MS = 12_000;
const DEV_BYPASS_PREFIX = process.env.AUTH_DEV_BYPASS_PREFIX || 'dev:';
const MAX_BOOKING_CANDIDATES = 20;
const MAX_CREATE_ATTEMPTS = 8;
const MAX_SLOTS_PER_BARBER_PER_QUERY = 3;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const emitSmokeSummary = ({ smokeId, checkoutResult }) => {
  const payload = {
    smokeId,
    checkout: checkoutResult
      ? {
          name: checkoutResult.name,
          status: checkoutResult.status,
          ok: checkoutResult.ok,
          skipped: Boolean(checkoutResult.skipped),
          reason: checkoutResult.reason || null,
        }
      : null,
  };
  console.log(`[migration:smoke:summary] ${JSON.stringify(payload)}`);
};

const emitSmokeDetails = ({ smokeId, results }) => {
  const payload = {
    smokeId,
    checks: results.map((result) => ({
      name: result.name,
      status: result.status,
      ok: Boolean(result.ok),
      skipped: Boolean(result.skipped),
      reason: result.reason || null,
    })),
  };
  console.log(`[migration:smoke:details] ${JSON.stringify(payload)}`);
};

const formatDateOnly = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date value: ${value}`);
  }
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDays = (dateOnly, days) => {
  const base = new Date(`${dateOnly}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return formatDateOnly(base);
};

const findFreePort = async () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      if (!port) {
        server.close(() => reject(new Error('Unable to resolve ephemeral port')));
        return;
      }
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        resolve(port);
      });
    });
  });

const normalizeBaseDomain = (value) =>
  (value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '')
    .replace(/^\.+|\.+$/g, '');

const resolveTenantHostHeader = (subdomain, port) => {
  const normalizedBaseDomain = normalizeBaseDomain(process.env.TENANT_BASE_DOMAIN || 'managgio.com');
  const hasSubdomainSlot = normalizedBaseDomain.includes('.');
  const hostName = hasSubdomainSlot ? `${subdomain}.${normalizedBaseDomain}` : `${subdomain}.localhost`;
  return `${hostName}:${port}`;
};

const parseJsonSafe = (raw) => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

const pickActors = async () => {
  const prisma = new PrismaClient();
  try {
    const configuredSubdomain = (process.env.DEFAULT_BRAND_SUBDOMAIN || '').trim().toLowerCase();

    const preferredBrand = configuredSubdomain
      ? await prisma.brand.findFirst({
        where: { subdomain: configuredSubdomain, isActive: true },
        select: { id: true, subdomain: true, defaultLocationId: true },
      })
      : null;

    const brand =
      preferredBrand ||
      (await prisma.brand.findFirst({
        where: { isActive: true },
        orderBy: [{ createdAt: 'asc' }],
        select: { id: true, subdomain: true, defaultLocationId: true },
      }));
    if (!brand) {
      throw new Error('No active brand found for authenticated smoke.');
    }

    const activeLocations = await prisma.location.findMany({
      where: { brandId: brand.id, isActive: true },
      orderBy: [{ createdAt: 'asc' }],
      select: { id: true },
    });
    if (activeLocations.length === 0) {
      throw new Error(`No active location found for brand ${brand.subdomain}.`);
    }

    const candidateLocationIds = Array.from(
      new Set([
        ...(brand.defaultLocationId ? [brand.defaultLocationId] : []),
        ...activeLocations.map((item) => item.id),
      ]),
    );

    let localId = null;
    let barberIds = [];
    let serviceIds = [];

    for (const locationId of candidateLocationIds) {
      // eslint-disable-next-line no-await-in-loop
      const locationBarberIds = (
        await prisma.barber.findMany({
          where: { localId: locationId, isActive: true, isArchived: false },
          orderBy: [{ createdAt: 'asc' }],
          take: 8,
          select: { id: true },
        })
      ).map((item) => item.id);
      // eslint-disable-next-line no-await-in-loop
      const locationServiceIds = (
        await prisma.service.findMany({
          where: { localId: locationId, isArchived: false },
          orderBy: [{ createdAt: 'asc' }],
          take: 8,
          select: { id: true },
        })
      ).map((item) => item.id);

      if (locationBarberIds.length === 0 || locationServiceIds.length === 0) continue;

      localId = locationId;
      barberIds = locationBarberIds;
      serviceIds = locationServiceIds;
      break;
    }

    if (!localId || barberIds.length === 0 || serviceIds.length === 0) {
      throw new Error(`No barber/service candidates found for brand ${brand.subdomain}.`);
    }

    const userActor = await prisma.user.findFirst({
      where: { firebaseUid: { not: null } },
      select: {
        id: true,
        email: true,
        firebaseUid: true,
        role: true,
        isSuperAdmin: true,
        isPlatformAdmin: true,
      },
      orderBy: [{ createdAt: 'asc' }],
    });
    if (!userActor?.firebaseUid) {
      throw new Error('No authenticated smoke actor found (missing user with firebaseUid).');
    }

    const adminActor = await prisma.user.findFirst({
      where: {
        firebaseUid: { not: null },
        OR: [{ isSuperAdmin: true }, { isPlatformAdmin: true }, { role: 'admin' }],
      },
      select: {
        id: true,
        email: true,
        firebaseUid: true,
        role: true,
        isSuperAdmin: true,
        isPlatformAdmin: true,
      },
      orderBy: [{ isSuperAdmin: 'desc' }, { isPlatformAdmin: 'desc' }, { createdAt: 'asc' }],
    });

    const clientActor = await prisma.user.findFirst({
      where: {
        role: 'client',
        brandMemberships: { some: { brandId: brand.id } },
      },
      select: { id: true },
      orderBy: [{ createdAt: 'asc' }],
    });

    return {
      userActor,
      adminActor,
      clientUserId: clientActor?.id || null,
      tenantFixture: {
        brandId: brand.id,
        subdomain: brand.subdomain,
        localId,
      },
      bookingCandidates: {
        barberIds,
        serviceIds,
      },
    };
  } finally {
    await prisma.$disconnect();
  }
};

const createHeaders = ({ hostHeader, tenantFixture, token, hasBody }) => {
  const headers = {
    Host: hostHeader,
    Accept: 'application/json',
    'x-local-id': tenantFixture.localId,
    'x-tenant-subdomain': tenantFixture.subdomain,
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (hasBody) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
};

const requestJson = async ({
  baseUrl,
  hostHeader,
  tenantFixture,
  method,
  path,
  token,
  body,
}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const hasBody = body !== undefined;

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: createHeaders({ hostHeader, tenantFixture, token, hasBody }),
      body: hasBody ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const rawBody = await response.text();
    return {
      status: response.status,
      body: parseJsonSafe(rawBody),
    };
  } finally {
    clearTimeout(timeout);
  }
};

const runReadChecks = async ({
  baseUrl,
  hostHeader,
  tenantFixture,
  userActor,
  adminActor,
  bookingCandidates,
}) => {
  const userToken = `${DEV_BYPASS_PREFIX}${userActor.firebaseUid}`;
  const primaryBarberId = bookingCandidates?.barberIds?.[0] || null;
  const primaryServiceId = bookingCandidates?.serviceIds?.[0] || null;
  const checks = [
    {
      name: 'auth.users.self',
      method: 'GET',
      path: `/api/users/${encodeURIComponent(userActor.id)}`,
      token: userToken,
      allowForbidden: false,
    },
    {
      name: 'auth.users.by-firebase.self',
      method: 'GET',
      path: `/api/users/by-firebase/${encodeURIComponent(userActor.firebaseUid)}`,
      token: userToken,
      allowForbidden: false,
    },
    {
      name: 'auth.users.by-email.self',
      method: 'GET',
      path: `/api/users/by-email?email=${encodeURIComponent(userActor.email)}`,
      token: userToken,
      allowForbidden: false,
    },
    {
      name: 'auth.barbers.list',
      method: 'GET',
      path: '/api/barbers',
      token: userToken,
      allowForbidden: false,
    },
    {
      name: 'auth.services.list',
      method: 'GET',
      path: '/api/services',
      token: userToken,
      allowForbidden: false,
    },
    {
      name: 'auth.products.public',
      method: 'GET',
      path: '/api/products?context=booking',
      token: userToken,
      allowForbidden: false,
    },
    {
      name: 'auth.offers.list',
      method: 'GET',
      path: '/api/offers',
      token: userToken,
      allowForbidden: false,
    },
    {
      name: 'auth.offers.active',
      method: 'GET',
      path: '/api/offers/active',
      token: userToken,
      allowForbidden: false,
    },
    {
      name: 'auth.subscriptions.me',
      method: 'GET',
      path: '/api/subscriptions/me',
      token: userToken,
      allowForbidden: false,
    },
    {
      name: 'auth.subscriptions.me.active',
      method: 'GET',
      path: '/api/subscriptions/me/active',
      token: userToken,
      allowForbidden: false,
    },
    {
      name: 'auth.payments.availability',
      method: 'GET',
      path: '/api/payments/stripe/availability',
      token: userToken,
      allowForbidden: false,
    },
    {
      name: 'auth.loyalty.programs.active',
      method: 'GET',
      path: '/api/loyalty/programs/active',
      token: userToken,
      allowForbidden: false,
    },
    {
      name: 'auth.referrals.my-summary',
      method: 'GET',
      path: `/api/referrals/my-summary?userId=${encodeURIComponent(userActor.id)}`,
      token: userToken,
      allowForbidden: false,
    },
    {
      name: 'auth.reviews.pending',
      method: 'GET',
      path: `/api/reviews/pending?userId=${encodeURIComponent(userActor.id)}`,
      token: userToken,
      allowForbidden: false,
    },
  ];

  const results = [];
  if (primaryBarberId) {
    checks.push({
      name: 'auth.barbers.by-id',
      method: 'GET',
      path: `/api/barbers/${encodeURIComponent(primaryBarberId)}`,
      token: userToken,
      allowForbidden: false,
    });
  } else {
    results.push({
      name: 'auth.barbers.by-id',
      status: 'SKIP',
      ok: true,
      skipped: true,
      reason: 'barber-fixture-missing',
    });
  }

  if (primaryServiceId) {
    checks.push({
      name: 'auth.services.by-id',
      method: 'GET',
      path: `/api/services/${encodeURIComponent(primaryServiceId)}`,
      token: userToken,
      allowForbidden: false,
    });
  } else {
    results.push({
      name: 'auth.services.by-id',
      status: 'SKIP',
      ok: true,
      skipped: true,
      reason: 'service-fixture-missing',
    });
  }

  if (adminActor?.firebaseUid) {
    const adminToken = `${DEV_BYPASS_PREFIX}${adminActor.firebaseUid}`;
    checks.push({
      name: 'auth.admin.users.list',
      method: 'GET',
      path: '/api/users?page=1&pageSize=20',
      token: adminToken,
      allowForbidden: !(adminActor.isSuperAdmin || adminActor.isPlatformAdmin),
    });
    checks.push({
      name: 'auth.admin.barbers.list',
      method: 'GET',
      path: '/api/barbers/admin',
      token: adminToken,
      allowForbidden: !(adminActor.isSuperAdmin || adminActor.isPlatformAdmin),
    });
    checks.push({
      name: 'auth.admin.products.list',
      method: 'GET',
      path: '/api/products/admin',
      token: adminToken,
      allowForbidden: !(adminActor.isSuperAdmin || adminActor.isPlatformAdmin),
    });
    checks.push({
      name: 'auth.admin.subscriptions.plans',
      method: 'GET',
      path: '/api/subscriptions/plans',
      token: adminToken,
      allowForbidden: !(adminActor.isSuperAdmin || adminActor.isPlatformAdmin),
    });
    checks.push({
      name: 'auth.admin.payments.stripe.config',
      method: 'GET',
      path: '/api/admin/payments/stripe/config',
      token: adminToken,
      allowForbidden: !(adminActor.isSuperAdmin || adminActor.isPlatformAdmin),
    });
    checks.push({
      name: 'auth.admin.loyalty.programs',
      method: 'GET',
      path: '/api/loyalty/programs',
      token: adminToken,
      allowForbidden: !(adminActor.isSuperAdmin || adminActor.isPlatformAdmin),
    });
    checks.push({
      name: 'auth.admin.reviews.config',
      method: 'GET',
      path: '/api/admin/reviews/config',
      token: adminToken,
      allowForbidden: !(adminActor.isSuperAdmin || adminActor.isPlatformAdmin),
    });
    checks.push({
      name: 'auth.admin.reviews.metrics',
      method: 'GET',
      path: '/api/admin/reviews/metrics',
      token: adminToken,
      allowForbidden: !(adminActor.isSuperAdmin || adminActor.isPlatformAdmin),
    });
    checks.push({
      name: 'auth.admin.referrals.list',
      method: 'GET',
      path: '/api/admin/referrals/list?page=1&pageSize=20',
      token: adminToken,
      allowForbidden: !(adminActor.isSuperAdmin || adminActor.isPlatformAdmin),
    });
    checks.push({
      name: 'auth.admin.referrals.config',
      method: 'GET',
      path: '/api/admin/referrals/config',
      token: adminToken,
      allowForbidden: !(adminActor.isSuperAdmin || adminActor.isPlatformAdmin),
    });
    checks.push({
      name: 'auth.admin.notifications.test-sms',
      method: 'POST',
      path: '/api/notifications/test-sms',
      token: adminToken,
      allowForbidden: !(adminActor.isSuperAdmin || adminActor.isPlatformAdmin),
      body: {
        phone: 'invalid-phone',
        message: 'smoke-notification-check',
      },
    });
    checks.push({
      name: 'auth.admin.notifications.test-whatsapp',
      method: 'POST',
      path: '/api/notifications/test-whatsapp',
      token: adminToken,
      allowForbidden: !(adminActor.isSuperAdmin || adminActor.isPlatformAdmin),
      body: {
        phone: 'invalid-phone',
        message: 'smoke-notification-check',
      },
    });
    if (adminActor.isPlatformAdmin) {
      checks.push({
        name: 'auth.platform.metrics',
        method: 'GET',
        path: '/api/platform/metrics?window=7',
        token: adminToken,
        allowForbidden: false,
      });
      checks.push({
        name: 'auth.platform.brands.list',
        method: 'GET',
        path: '/api/platform/brands',
        token: adminToken,
        allowForbidden: false,
      });
      checks.push({
        name: 'auth.platform.brand.health',
        method: 'GET',
        path: `/api/platform/brands/${encodeURIComponent(tenantFixture.brandId)}/health`,
        token: adminToken,
        allowForbidden: false,
      });
      checks.push({
        name: 'auth.platform.observability.web-vitals',
        method: 'GET',
        path: '/api/platform/observability/web-vitals?minutes=60',
        token: adminToken,
        allowForbidden: false,
      });
      checks.push({
        name: 'auth.platform.observability.api',
        method: 'GET',
        path: '/api/platform/observability/api?minutes=60',
        token: adminToken,
        allowForbidden: false,
      });
    } else {
      results.push({
        name: 'auth.platform.metrics',
        status: 'SKIP',
        ok: true,
        skipped: true,
        reason: 'platform_admin_actor_missing',
      });
      results.push({
        name: 'auth.platform.brands.list',
        status: 'SKIP',
        ok: true,
        skipped: true,
        reason: 'platform_admin_actor_missing',
      });
      results.push({
        name: 'auth.platform.brand.health',
        status: 'SKIP',
        ok: true,
        skipped: true,
        reason: 'platform_admin_actor_missing',
      });
      results.push({
        name: 'auth.platform.observability.web-vitals',
        status: 'SKIP',
        ok: true,
        skipped: true,
        reason: 'platform_admin_actor_missing',
      });
      results.push({
        name: 'auth.platform.observability.api',
        status: 'SKIP',
        ok: true,
        skipped: true,
        reason: 'platform_admin_actor_missing',
      });
    }
  } else {
    results.push({
      name: 'auth.platform.metrics',
      status: 'SKIP',
      ok: true,
      skipped: true,
      reason: 'admin_actor_missing',
    });
    results.push({
      name: 'auth.platform.brands.list',
      status: 'SKIP',
      ok: true,
      skipped: true,
      reason: 'admin_actor_missing',
    });
    results.push({
      name: 'auth.platform.brand.health',
      status: 'SKIP',
      ok: true,
      skipped: true,
      reason: 'admin_actor_missing',
    });
    results.push({
      name: 'auth.platform.observability.web-vitals',
      status: 'SKIP',
      ok: true,
      skipped: true,
      reason: 'admin_actor_missing',
    });
    results.push({
      name: 'auth.platform.observability.api',
      status: 'SKIP',
      ok: true,
      skipped: true,
      reason: 'admin_actor_missing',
    });
  }

  for (const check of checks) {
    // eslint-disable-next-line no-await-in-loop
    const response = await requestJson({
      baseUrl,
      hostHeader,
      tenantFixture,
      method: check.method,
      path: check.path,
      token: check.token,
      body: check.body,
    });

    const unauthorized = response.status === 401;
    const forbidden = response.status === 403;
    const serverError = response.status >= 500;
    const ok = !unauthorized && !serverError && (check.allowForbidden || !forbidden);

    results.push({
      name: check.name,
      status: response.status,
      ok,
      responseBody: response.body,
    });
  }

  return results;
};

const is2xx = (status) => typeof status === 'number' && status >= 200 && status < 300;

const readBodyField = (body, key) =>
  body && typeof body === 'object' && body[key] !== undefined ? body[key] : null;

const runCrudCapabilityChecks = async ({
  baseUrl,
  hostHeader,
  tenantFixture,
  adminActor,
  clientUserId,
  bookingCandidates,
}) => {
  const checkNames = [
    'auth.crud.roles.create',
    'auth.crud.roles.update',
    'auth.crud.roles.delete',
    'auth.crud.barbers.create',
    'auth.crud.barbers.update',
    'auth.crud.barbers.service-assignment',
    'auth.crud.barbers.delete',
    'auth.crud.alerts.create',
    'auth.crud.alerts.update',
    'auth.crud.alerts.delete',
    'auth.crud.services.create',
    'auth.crud.services.update',
    'auth.crud.services.delete',
    'auth.crud.products.create',
    'auth.crud.products.update',
    'auth.crud.products.delete',
    'auth.crud.offers.create',
    'auth.crud.offers.update',
    'auth.crud.offers.delete',
    'auth.crud.service-categories.create',
    'auth.crud.service-categories.update',
    'auth.crud.service-categories.delete',
    'auth.crud.product-categories.create',
    'auth.crud.product-categories.update',
    'auth.crud.product-categories.delete',
    'auth.crud.client-notes.list',
    'auth.crud.client-notes.create',
    'auth.crud.client-notes.update',
    'auth.crud.client-notes.delete',
    'auth.crud.schedules.shop.get',
    'auth.crud.schedules.shop.update',
    'auth.crud.schedules.barber.get',
    'auth.crud.schedules.barber.update',
    'auth.crud.holidays.general.add',
    'auth.crud.holidays.general.remove',
    'auth.crud.holidays.barber.add',
    'auth.crud.holidays.barber.remove',
    'auth.admin.notifications.test-sms',
    'auth.admin.notifications.test-whatsapp',
  ];

  if (!adminActor?.firebaseUid) {
    return checkNames.map((name) => ({
      name,
      status: 'SKIP',
      ok: true,
      skipped: true,
      reason: 'admin_actor_missing',
    }));
  }

  const adminToken = `${DEV_BYPASS_PREFIX}${adminActor.firebaseUid}`;
  const nowTag = Date.now();
  const results = [];
  const primaryBarberId = bookingCandidates?.barberIds?.[0] || null;
  const existingServiceCategories = await requestJson({
    baseUrl,
    hostHeader,
    tenantFixture,
    method: 'GET',
    path: '/api/service-categories?withServices=false',
    token: adminToken,
  });
  const serviceCategoryCandidateId = Array.isArray(existingServiceCategories.body)
    ? readBodyField(existingServiceCategories.body[0], 'id')
    : null;
  const existingProductCategories = await requestJson({
    baseUrl,
    hostHeader,
    tenantFixture,
    method: 'GET',
    path: '/api/product-categories?withProducts=false',
    token: adminToken,
  });
  const productCategoryCandidateId = Array.isArray(existingProductCategories.body)
    ? readBodyField(existingProductCategories.body[0], 'id')
    : null;

  const roleCreate = await requestJson({
    baseUrl,
    hostHeader,
    tenantFixture,
    method: 'POST',
    path: '/api/roles',
    token: adminToken,
    body: {
      name: `Smoke Role ${nowTag}`,
      description: 'smoke role',
      permissions: ['appointments.read'],
    },
  });
  const roleId = readBodyField(roleCreate.body, 'id');
  results.push({
    name: 'auth.crud.roles.create',
    status: roleCreate.status,
    ok: is2xx(roleCreate.status),
    responseBody: roleCreate.body,
  });

  if (is2xx(roleCreate.status) && roleId) {
    const roleUpdate = await requestJson({
      baseUrl,
      hostHeader,
      tenantFixture,
      method: 'PATCH',
      path: `/api/roles/${encodeURIComponent(roleId)}`,
      token: adminToken,
      body: {
        name: `Smoke Role Updated ${nowTag}`,
      },
    });
    results.push({
      name: 'auth.crud.roles.update',
      status: roleUpdate.status,
      ok: is2xx(roleUpdate.status),
      responseBody: roleUpdate.body,
    });

    const roleDelete = await requestJson({
      baseUrl,
      hostHeader,
      tenantFixture,
      method: 'DELETE',
      path: `/api/roles/${encodeURIComponent(roleId)}`,
      token: adminToken,
    });
    results.push({
      name: 'auth.crud.roles.delete',
      status: roleDelete.status,
      ok: is2xx(roleDelete.status),
      responseBody: roleDelete.body,
    });
  } else {
    results.push(
      {
        name: 'auth.crud.roles.update',
        status: 'SKIP',
        ok: true,
        skipped: true,
        reason: 'roles-create-failed',
      },
      {
        name: 'auth.crud.roles.delete',
        status: 'SKIP',
        ok: true,
        skipped: true,
        reason: 'roles-create-failed',
      },
    );
  }

  const barberCreate = await requestJson({
    baseUrl,
    hostHeader,
    tenantFixture,
    method: 'POST',
    path: '/api/barbers',
    token: adminToken,
    body: {
      name: `Smoke Barber ${nowTag}`,
      specialty: 'Smoke Specialty',
      startDate: formatDateOnly(new Date()),
      isActive: true,
    },
  });
  const createdBarberId = readBodyField(barberCreate.body, 'id');
  results.push({
    name: 'auth.crud.barbers.create',
    status: barberCreate.status,
    ok: is2xx(barberCreate.status),
    responseBody: barberCreate.body,
  });

  if (is2xx(barberCreate.status) && createdBarberId) {
    const barberUpdate = await requestJson({
      baseUrl,
      hostHeader,
      tenantFixture,
      method: 'PATCH',
      path: `/api/barbers/${encodeURIComponent(createdBarberId)}`,
      token: adminToken,
      body: {
        name: `Smoke Barber Updated ${nowTag}`,
      },
    });
    results.push({
      name: 'auth.crud.barbers.update',
      status: barberUpdate.status,
      ok: is2xx(barberUpdate.status),
      responseBody: barberUpdate.body,
    });

    const assignmentServiceId = bookingCandidates?.serviceIds?.[0] || null;
    if (!assignmentServiceId) {
      results.push({
        name: 'auth.crud.barbers.service-assignment',
        status: 'SKIP',
        ok: true,
        skipped: true,
        reason: 'service-fixture-missing',
      });
    } else {
      const barberAssignment = await requestJson({
        baseUrl,
        hostHeader,
        tenantFixture,
        method: 'PATCH',
        path: `/api/barbers/${encodeURIComponent(createdBarberId)}/service-assignment`,
        token: adminToken,
        body: {
          serviceIds: [assignmentServiceId],
          categoryIds: [],
        },
      });
      results.push({
        name: 'auth.crud.barbers.service-assignment',
        status: barberAssignment.status,
        ok: is2xx(barberAssignment.status),
        responseBody: barberAssignment.body,
      });
    }

    const barberDelete = await requestJson({
      baseUrl,
      hostHeader,
      tenantFixture,
      method: 'DELETE',
      path: `/api/barbers/${encodeURIComponent(createdBarberId)}`,
      token: adminToken,
    });
    results.push({
      name: 'auth.crud.barbers.delete',
      status: barberDelete.status,
      ok: is2xx(barberDelete.status),
      responseBody: barberDelete.body,
    });
  } else {
    results.push(
      {
        name: 'auth.crud.barbers.update',
        status: 'SKIP',
        ok: true,
        skipped: true,
        reason: 'barbers-create-failed',
      },
      {
        name: 'auth.crud.barbers.service-assignment',
        status: 'SKIP',
        ok: true,
        skipped: true,
        reason: 'barbers-create-failed',
      },
      {
        name: 'auth.crud.barbers.delete',
        status: 'SKIP',
        ok: true,
        skipped: true,
        reason: 'barbers-create-failed',
      },
    );
  }

  const alertCreate = await requestJson({
    baseUrl,
    hostHeader,
    tenantFixture,
    method: 'POST',
    path: '/api/alerts',
    token: adminToken,
    body: {
      title: `Smoke Alert ${nowTag}`,
      message: 'smoke alert message',
      active: true,
      type: 'info',
    },
  });
  const alertId = readBodyField(alertCreate.body, 'id');
  results.push({
    name: 'auth.crud.alerts.create',
    status: alertCreate.status,
    ok: is2xx(alertCreate.status),
    responseBody: alertCreate.body,
  });

  if (is2xx(alertCreate.status) && alertId) {
    const alertUpdate = await requestJson({
      baseUrl,
      hostHeader,
      tenantFixture,
      method: 'PATCH',
      path: `/api/alerts/${encodeURIComponent(alertId)}`,
      token: adminToken,
      body: {
        title: `Smoke Alert Updated ${nowTag}`,
      },
    });
    results.push({
      name: 'auth.crud.alerts.update',
      status: alertUpdate.status,
      ok: is2xx(alertUpdate.status),
      responseBody: alertUpdate.body,
    });

    const alertDelete = await requestJson({
      baseUrl,
      hostHeader,
      tenantFixture,
      method: 'DELETE',
      path: `/api/alerts/${encodeURIComponent(alertId)}`,
      token: adminToken,
    });
    results.push({
      name: 'auth.crud.alerts.delete',
      status: alertDelete.status,
      ok: is2xx(alertDelete.status),
      responseBody: alertDelete.body,
    });
  } else {
    results.push(
      {
        name: 'auth.crud.alerts.update',
        status: 'SKIP',
        ok: true,
        skipped: true,
        reason: 'alerts-create-failed',
      },
      {
        name: 'auth.crud.alerts.delete',
        status: 'SKIP',
        ok: true,
        skipped: true,
        reason: 'alerts-create-failed',
      },
    );
  }

  const serviceCreateBody = {
    name: `Smoke Service ${nowTag}`,
    description: 'smoke service',
    price: 10,
    duration: 30,
    ...(serviceCategoryCandidateId ? { categoryId: serviceCategoryCandidateId } : {}),
  };

  const serviceCreate = await requestJson({
    baseUrl,
    hostHeader,
    tenantFixture,
    method: 'POST',
    path: '/api/services',
    token: adminToken,
    body: serviceCreateBody,
  });
  const createdServiceId = readBodyField(serviceCreate.body, 'id');

  if (!serviceCategoryCandidateId && serviceCreate.status === 400) {
    results.push(
      {
        name: 'auth.crud.services.create',
        status: 'SKIP',
        ok: true,
        skipped: true,
        reason: 'service-category-required',
      },
      {
        name: 'auth.crud.services.update',
        status: 'SKIP',
        ok: true,
        skipped: true,
        reason: 'service-category-required',
      },
      {
        name: 'auth.crud.services.delete',
        status: 'SKIP',
        ok: true,
        skipped: true,
        reason: 'service-category-required',
      },
    );
  } else {
    results.push({
      name: 'auth.crud.services.create',
      status: serviceCreate.status,
      ok: is2xx(serviceCreate.status),
      responseBody: serviceCreate.body,
    });

    if (is2xx(serviceCreate.status) && createdServiceId) {
      const serviceUpdate = await requestJson({
        baseUrl,
        hostHeader,
        tenantFixture,
        method: 'PATCH',
        path: `/api/services/${encodeURIComponent(createdServiceId)}`,
        token: adminToken,
        body: {
          name: `Smoke Service Updated ${nowTag}`,
          price: 11,
          duration: 35,
          ...(serviceCategoryCandidateId ? { categoryId: serviceCategoryCandidateId } : {}),
        },
      });
      results.push({
        name: 'auth.crud.services.update',
        status: serviceUpdate.status,
        ok: is2xx(serviceUpdate.status),
        responseBody: serviceUpdate.body,
      });

      const serviceDelete = await requestJson({
        baseUrl,
        hostHeader,
        tenantFixture,
        method: 'DELETE',
        path: `/api/services/${encodeURIComponent(createdServiceId)}`,
        token: adminToken,
      });
      results.push({
        name: 'auth.crud.services.delete',
        status: serviceDelete.status,
        ok: is2xx(serviceDelete.status),
        responseBody: serviceDelete.body,
      });
    } else {
      results.push(
        {
          name: 'auth.crud.services.update',
          status: 'SKIP',
          ok: true,
          skipped: true,
          reason: 'services-create-failed',
        },
        {
          name: 'auth.crud.services.delete',
          status: 'SKIP',
          ok: true,
          skipped: true,
          reason: 'services-create-failed',
        },
      );
    }
  }

  const productCreateBody = {
    name: `Smoke Product ${nowTag}`,
    description: 'smoke product',
    price: 9,
    stock: 3,
    minStock: 1,
    ...(productCategoryCandidateId ? { categoryId: productCategoryCandidateId } : {}),
  };

  const productCreate = await requestJson({
    baseUrl,
    hostHeader,
    tenantFixture,
    method: 'POST',
    path: '/api/products',
    token: adminToken,
    body: productCreateBody,
  });
  const createdProductId = readBodyField(productCreate.body, 'id');

  if (!productCategoryCandidateId && productCreate.status === 400) {
    results.push(
      {
        name: 'auth.crud.products.create',
        status: 'SKIP',
        ok: true,
        skipped: true,
        reason: 'product-category-required',
      },
      {
        name: 'auth.crud.products.update',
        status: 'SKIP',
        ok: true,
        skipped: true,
        reason: 'product-category-required',
      },
      {
        name: 'auth.crud.products.delete',
        status: 'SKIP',
        ok: true,
        skipped: true,
        reason: 'product-category-required',
      },
    );
  } else {
    results.push({
      name: 'auth.crud.products.create',
      status: productCreate.status,
      ok: is2xx(productCreate.status),
      responseBody: productCreate.body,
    });

    if (is2xx(productCreate.status) && createdProductId) {
      const productUpdate = await requestJson({
        baseUrl,
        hostHeader,
        tenantFixture,
        method: 'PATCH',
        path: `/api/products/${encodeURIComponent(createdProductId)}`,
        token: adminToken,
        body: {
          name: `Smoke Product Updated ${nowTag}`,
          price: 11,
          stock: 5,
          ...(productCategoryCandidateId ? { categoryId: productCategoryCandidateId } : {}),
        },
      });
      results.push({
        name: 'auth.crud.products.update',
        status: productUpdate.status,
        ok: is2xx(productUpdate.status),
        responseBody: productUpdate.body,
      });

      const productDelete = await requestJson({
        baseUrl,
        hostHeader,
        tenantFixture,
        method: 'DELETE',
        path: `/api/products/${encodeURIComponent(createdProductId)}`,
        token: adminToken,
      });
      results.push({
        name: 'auth.crud.products.delete',
        status: productDelete.status,
        ok: is2xx(productDelete.status),
        responseBody: productDelete.body,
      });
    } else {
      results.push(
        {
          name: 'auth.crud.products.update',
          status: 'SKIP',
          ok: true,
          skipped: true,
          reason: 'products-create-failed',
        },
        {
          name: 'auth.crud.products.delete',
          status: 'SKIP',
          ok: true,
          skipped: true,
          reason: 'products-create-failed',
        },
      );
    }
  }

  const offerCreate = await requestJson({
    baseUrl,
    hostHeader,
    tenantFixture,
    method: 'POST',
    path: '/api/offers',
    token: adminToken,
    body: {
      name: `Smoke Offer ${nowTag}`,
      description: 'smoke offer',
      discountType: 'percentage',
      discountValue: 10,
      scope: 'all',
      target: 'service',
      active: true,
    },
  });
  const createdOfferId = readBodyField(offerCreate.body, 'id');
  results.push({
    name: 'auth.crud.offers.create',
    status: offerCreate.status,
    ok: is2xx(offerCreate.status),
    responseBody: offerCreate.body,
  });

  if (is2xx(offerCreate.status) && createdOfferId) {
    const offerUpdate = await requestJson({
      baseUrl,
      hostHeader,
      tenantFixture,
      method: 'PATCH',
      path: `/api/offers/${encodeURIComponent(createdOfferId)}`,
      token: adminToken,
      body: {
        name: `Smoke Offer Updated ${nowTag}`,
        active: false,
      },
    });
    results.push({
      name: 'auth.crud.offers.update',
      status: offerUpdate.status,
      ok: is2xx(offerUpdate.status),
      responseBody: offerUpdate.body,
    });

    const offerDelete = await requestJson({
      baseUrl,
      hostHeader,
      tenantFixture,
      method: 'DELETE',
      path: `/api/offers/${encodeURIComponent(createdOfferId)}`,
      token: adminToken,
    });
    results.push({
      name: 'auth.crud.offers.delete',
      status: offerDelete.status,
      ok: is2xx(offerDelete.status),
      responseBody: offerDelete.body,
    });
  } else {
    results.push(
      {
        name: 'auth.crud.offers.update',
        status: 'SKIP',
        ok: true,
        skipped: true,
        reason: 'offers-create-failed',
      },
      {
        name: 'auth.crud.offers.delete',
        status: 'SKIP',
        ok: true,
        skipped: true,
        reason: 'offers-create-failed',
      },
    );
  }

  const categoryCreate = await requestJson({
    baseUrl,
    hostHeader,
    tenantFixture,
    method: 'POST',
    path: '/api/service-categories',
    token: adminToken,
    body: {
      name: `Smoke Category ${nowTag}`,
      description: '',
      position: 999,
    },
  });
  const categoryId = readBodyField(categoryCreate.body, 'id');
  results.push({
    name: 'auth.crud.service-categories.create',
    status: categoryCreate.status,
    ok: is2xx(categoryCreate.status),
    responseBody: categoryCreate.body,
  });

  if (is2xx(categoryCreate.status) && categoryId) {
    const categoryUpdate = await requestJson({
      baseUrl,
      hostHeader,
      tenantFixture,
      method: 'PATCH',
      path: `/api/service-categories/${encodeURIComponent(categoryId)}`,
      token: adminToken,
      body: {
        name: `Smoke Category Updated ${nowTag}`,
        position: 1000,
      },
    });
    results.push({
      name: 'auth.crud.service-categories.update',
      status: categoryUpdate.status,
      ok: is2xx(categoryUpdate.status),
      responseBody: categoryUpdate.body,
    });

    const categoryDelete = await requestJson({
      baseUrl,
      hostHeader,
      tenantFixture,
      method: 'DELETE',
      path: `/api/service-categories/${encodeURIComponent(categoryId)}`,
      token: adminToken,
    });
    results.push({
      name: 'auth.crud.service-categories.delete',
      status: categoryDelete.status,
      ok: is2xx(categoryDelete.status),
      responseBody: categoryDelete.body,
    });
  } else {
    results.push(
      {
        name: 'auth.crud.service-categories.update',
        status: 'SKIP',
        ok: true,
        skipped: true,
        reason: 'service-categories-create-failed',
      },
      {
        name: 'auth.crud.service-categories.delete',
        status: 'SKIP',
        ok: true,
        skipped: true,
        reason: 'service-categories-create-failed',
      },
    );
  }

  const productCategoryCreate = await requestJson({
    baseUrl,
    hostHeader,
    tenantFixture,
    method: 'POST',
    path: '/api/product-categories',
    token: adminToken,
    body: {
      name: `Smoke Product Category ${nowTag}`,
      description: '',
      position: 999,
    },
  });
  const productCategoryId = readBodyField(productCategoryCreate.body, 'id');
  results.push({
    name: 'auth.crud.product-categories.create',
    status: productCategoryCreate.status,
    ok: is2xx(productCategoryCreate.status),
    responseBody: productCategoryCreate.body,
  });

  if (is2xx(productCategoryCreate.status) && productCategoryId) {
    const productCategoryUpdate = await requestJson({
      baseUrl,
      hostHeader,
      tenantFixture,
      method: 'PATCH',
      path: `/api/product-categories/${encodeURIComponent(productCategoryId)}`,
      token: adminToken,
      body: {
        name: `Smoke Product Category Updated ${nowTag}`,
        position: 1000,
      },
    });
    results.push({
      name: 'auth.crud.product-categories.update',
      status: productCategoryUpdate.status,
      ok: is2xx(productCategoryUpdate.status),
      responseBody: productCategoryUpdate.body,
    });

    const productCategoryDelete = await requestJson({
      baseUrl,
      hostHeader,
      tenantFixture,
      method: 'DELETE',
      path: `/api/product-categories/${encodeURIComponent(productCategoryId)}`,
      token: adminToken,
    });
    results.push({
      name: 'auth.crud.product-categories.delete',
      status: productCategoryDelete.status,
      ok: is2xx(productCategoryDelete.status),
      responseBody: productCategoryDelete.body,
    });
  } else {
    results.push(
      {
        name: 'auth.crud.product-categories.update',
        status: 'SKIP',
        ok: true,
        skipped: true,
        reason: 'product-categories-create-failed',
      },
      {
        name: 'auth.crud.product-categories.delete',
        status: 'SKIP',
        ok: true,
        skipped: true,
        reason: 'product-categories-create-failed',
      },
    );
  }

  if (!clientUserId) {
    results.push(
      {
        name: 'auth.crud.client-notes.list',
        status: 'SKIP',
        ok: true,
        skipped: true,
        reason: 'client-user-missing',
      },
      {
        name: 'auth.crud.client-notes.create',
        status: 'SKIP',
        ok: true,
        skipped: true,
        reason: 'client-user-missing',
      },
      {
        name: 'auth.crud.client-notes.update',
        status: 'SKIP',
        ok: true,
        skipped: true,
        reason: 'client-user-missing',
      },
      {
        name: 'auth.crud.client-notes.delete',
        status: 'SKIP',
        ok: true,
        skipped: true,
        reason: 'client-user-missing',
      },
    );

  } else {
    const clientNotesList = await requestJson({
      baseUrl,
      hostHeader,
      tenantFixture,
      method: 'GET',
      path: `/api/client-notes?userId=${encodeURIComponent(clientUserId)}`,
      token: adminToken,
    });
    results.push({
      name: 'auth.crud.client-notes.list',
      status: clientNotesList.status,
      ok: is2xx(clientNotesList.status),
      responseBody: clientNotesList.body,
    });

    const clientNoteCreate = await requestJson({
      baseUrl,
      hostHeader,
      tenantFixture,
      method: 'POST',
      path: '/api/client-notes',
      token: adminToken,
      body: {
        userId: clientUserId,
        content: `Smoke note ${nowTag}`,
      },
    });
    const clientNoteId = readBodyField(clientNoteCreate.body, 'id');
    results.push({
      name: 'auth.crud.client-notes.create',
      status: clientNoteCreate.status,
      ok: is2xx(clientNoteCreate.status),
      responseBody: clientNoteCreate.body,
    });

    if (is2xx(clientNoteCreate.status) && clientNoteId) {
      const clientNoteUpdate = await requestJson({
        baseUrl,
        hostHeader,
        tenantFixture,
        method: 'PATCH',
        path: `/api/client-notes/${encodeURIComponent(clientNoteId)}`,
        token: adminToken,
        body: {
          content: `Smoke note updated ${nowTag}`,
        },
      });
      results.push({
        name: 'auth.crud.client-notes.update',
        status: clientNoteUpdate.status,
        ok: is2xx(clientNoteUpdate.status),
        responseBody: clientNoteUpdate.body,
      });

      const clientNoteDelete = await requestJson({
        baseUrl,
        hostHeader,
        tenantFixture,
        method: 'DELETE',
        path: `/api/client-notes/${encodeURIComponent(clientNoteId)}`,
        token: adminToken,
      });
      results.push({
        name: 'auth.crud.client-notes.delete',
        status: clientNoteDelete.status,
        ok: is2xx(clientNoteDelete.status),
        responseBody: clientNoteDelete.body,
      });
    } else {
      results.push(
        {
          name: 'auth.crud.client-notes.update',
          status: 'SKIP',
          ok: true,
          skipped: true,
          reason: 'client-notes-create-failed',
        },
        {
          name: 'auth.crud.client-notes.delete',
          status: 'SKIP',
          ok: true,
          skipped: true,
          reason: 'client-notes-create-failed',
        },
      );
    }
  }

  const shopScheduleGet = await requestJson({
    baseUrl,
    hostHeader,
    tenantFixture,
    method: 'GET',
    path: '/api/schedules/shop',
    token: adminToken,
  });
  results.push({
    name: 'auth.crud.schedules.shop.get',
    status: shopScheduleGet.status,
    ok: is2xx(shopScheduleGet.status),
    responseBody: shopScheduleGet.body,
  });

  if (is2xx(shopScheduleGet.status) && shopScheduleGet.body) {
    const shopScheduleUpdate = await requestJson({
      baseUrl,
      hostHeader,
      tenantFixture,
      method: 'PUT',
      path: '/api/schedules/shop',
      token: adminToken,
      body: {
        schedule: shopScheduleGet.body,
      },
    });
    results.push({
      name: 'auth.crud.schedules.shop.update',
      status: shopScheduleUpdate.status,
      ok: is2xx(shopScheduleUpdate.status),
      responseBody: shopScheduleUpdate.body,
    });
  } else {
    results.push({
      name: 'auth.crud.schedules.shop.update',
      status: 'SKIP',
      ok: true,
      skipped: true,
      reason: 'schedules-shop-get-failed',
    });
  }

  if (!primaryBarberId) {
    results.push(
      {
        name: 'auth.crud.schedules.barber.get',
        status: 'SKIP',
        ok: true,
        skipped: true,
        reason: 'barber-missing',
      },
      {
        name: 'auth.crud.schedules.barber.update',
        status: 'SKIP',
        ok: true,
        skipped: true,
        reason: 'barber-missing',
      },
      {
        name: 'auth.crud.holidays.barber.add',
        status: 'SKIP',
        ok: true,
        skipped: true,
        reason: 'barber-missing',
      },
      {
        name: 'auth.crud.holidays.barber.remove',
        status: 'SKIP',
        ok: true,
        skipped: true,
        reason: 'barber-missing',
      },
    );
  } else {
    const barberScheduleGet = await requestJson({
      baseUrl,
      hostHeader,
      tenantFixture,
      method: 'GET',
      path: `/api/schedules/barbers/${encodeURIComponent(primaryBarberId)}`,
      token: adminToken,
    });
    results.push({
      name: 'auth.crud.schedules.barber.get',
      status: barberScheduleGet.status,
      ok: is2xx(barberScheduleGet.status),
      responseBody: barberScheduleGet.body,
    });

    if (is2xx(barberScheduleGet.status) && barberScheduleGet.body) {
      const barberScheduleUpdate = await requestJson({
        baseUrl,
        hostHeader,
        tenantFixture,
        method: 'PUT',
        path: `/api/schedules/barbers/${encodeURIComponent(primaryBarberId)}`,
        token: adminToken,
        body: {
          schedule: barberScheduleGet.body,
        },
      });
      results.push({
        name: 'auth.crud.schedules.barber.update',
        status: barberScheduleUpdate.status,
        ok: is2xx(barberScheduleUpdate.status),
        responseBody: barberScheduleUpdate.body,
      });
    } else {
      results.push({
        name: 'auth.crud.schedules.barber.update',
        status: 'SKIP',
        ok: true,
        skipped: true,
        reason: 'schedules-barber-get-failed',
      });
    }

    const today = formatDateOnly(new Date());
    const holidayDate = addDays(today, 30);

    const barberHolidayAdd = await requestJson({
      baseUrl,
      hostHeader,
      tenantFixture,
      method: 'POST',
      path: `/api/holidays/barbers/${encodeURIComponent(primaryBarberId)}`,
      token: adminToken,
      body: {
        start: holidayDate,
        end: holidayDate,
      },
    });
    results.push({
      name: 'auth.crud.holidays.barber.add',
      status: barberHolidayAdd.status,
      ok: is2xx(barberHolidayAdd.status),
      responseBody: barberHolidayAdd.body,
    });

    const barberHolidayRemove = await requestJson({
      baseUrl,
      hostHeader,
      tenantFixture,
      method: 'DELETE',
      path: `/api/holidays/barbers/${encodeURIComponent(primaryBarberId)}`,
      token: adminToken,
      body: {
        start: holidayDate,
        end: holidayDate,
      },
    });
    results.push({
      name: 'auth.crud.holidays.barber.remove',
      status: barberHolidayRemove.status,
      ok: is2xx(barberHolidayRemove.status),
      responseBody: barberHolidayRemove.body,
    });
  }

  const today = formatDateOnly(new Date());
  const generalHolidayDate = addDays(today, 31);

  const generalHolidayAdd = await requestJson({
    baseUrl,
    hostHeader,
    tenantFixture,
    method: 'POST',
    path: '/api/holidays/general',
    token: adminToken,
    body: {
      start: generalHolidayDate,
      end: generalHolidayDate,
    },
  });
  results.push({
    name: 'auth.crud.holidays.general.add',
    status: generalHolidayAdd.status,
    ok: is2xx(generalHolidayAdd.status),
    responseBody: generalHolidayAdd.body,
  });

  const generalHolidayRemove = await requestJson({
    baseUrl,
    hostHeader,
    tenantFixture,
    method: 'DELETE',
    path: '/api/holidays/general',
    token: adminToken,
    body: {
      start: generalHolidayDate,
      end: generalHolidayDate,
    },
  });
  results.push({
    name: 'auth.crud.holidays.general.remove',
    status: generalHolidayRemove.status,
    ok: is2xx(generalHolidayRemove.status),
    responseBody: generalHolidayRemove.body,
  });

  return results;
};

const resolveValidBookingPayloads = async ({ baseUrl, hostHeader, tenantFixture, bookingCandidates }) => {
  const today = formatDateOnly(new Date());
  const payloads = [];
  const seen = new Set();

  for (let dayOffset = 0; dayOffset <= 21; dayOffset += 1) {
    const date = addDays(today, dayOffset);

    for (const serviceId of bookingCandidates.serviceIds) {
      const params = new URLSearchParams({
        date,
        barberIds: bookingCandidates.barberIds.join(','),
        serviceId,
      });

      // eslint-disable-next-line no-await-in-loop
      const response = await requestJson({
        baseUrl,
        hostHeader,
        tenantFixture,
        method: 'GET',
        path: `/api/appointments/availability-batch?${params.toString()}`,
      });

      if (response.status !== 200 || !response.body || typeof response.body !== 'object') {
        continue;
      }

      for (const barberId of bookingCandidates.barberIds) {
        const slots = response.body[barberId];
        if (!Array.isArray(slots) || slots.length === 0) continue;

        for (const slot of slots.slice(0, MAX_SLOTS_PER_BARBER_PER_QUERY)) {
          const startDateTime = new Date(`${date}T${slot}:00`).toISOString();
          const key = `${barberId}|${serviceId}|${startDateTime}`;
          if (seen.has(key)) continue;
          seen.add(key);
          payloads.push({
            barberId,
            serviceId,
            date,
            slot,
            startDateTime,
          });
          if (payloads.length >= MAX_BOOKING_CANDIDATES) {
            return payloads;
          }
        }
      }
    }
  }

  return payloads;
};

const cleanupAppointment = async ({ baseUrl, hostHeader, tenantFixture, token, appointmentId }) => {
  if (!appointmentId) return;

  try {
    await requestJson({
      baseUrl,
      hostHeader,
      tenantFixture,
      method: 'DELETE',
      path: `/api/appointments/${encodeURIComponent(appointmentId)}`,
      token,
    });
  } catch {
    // best-effort cleanup for smoke data
  }
};

const runWriteChecks = async ({
  baseUrl,
  hostHeader,
  tenantFixture,
  userActor,
  adminActor,
  clientUserId,
  bookingCandidates,
}) => {
  const userToken = `${DEV_BYPASS_PREFIX}${userActor.firebaseUid}`;
  const bookingPayloads = await resolveValidBookingPayloads({
    baseUrl,
    hostHeader,
    tenantFixture,
    bookingCandidates,
  });

  if (bookingPayloads.length === 0) {
    const baseResults = [
      {
        name: 'auth.appointments.create.valid',
        status: null,
        ok: false,
        error: 'No available booking slot found for valid payload in next 21 days.',
      },
      {
        name: 'auth.payments.checkout.valid',
        status: 'SKIP',
        ok: true,
        skipped: true,
        reason: 'create-valid-precondition-missing',
      },
    ];

    const crudCapabilityResults = await runCrudCapabilityChecks({
      baseUrl,
      hostHeader,
      tenantFixture,
      adminActor,
      clientUserId,
      bookingCandidates,
    });

    return [...baseResults, ...crudCapabilityResults];
  }

  const results = [];
  let bookingPayload = bookingPayloads[0];
  let createResponse = null;

  for (const candidate of bookingPayloads.slice(0, MAX_CREATE_ATTEMPTS)) {
    bookingPayload = candidate;
    // eslint-disable-next-line no-await-in-loop
    const response = await requestJson({
      baseUrl,
      hostHeader,
      tenantFixture,
      method: 'POST',
      path: '/api/appointments',
      token: userToken,
      body: {
        barberId: candidate.barberId,
        serviceId: candidate.serviceId,
        startDateTime: candidate.startDateTime,
        guestName: 'Smoke Test Create',
        guestContact: 'smoke-create@example.com',
        privacyConsentGiven: true,
      },
    });
    createResponse = response;
    if (response.status >= 200 && response.status < 300) {
      break;
    }

    const errorMessage = typeof response.body === 'object' && response.body
      ? String(response.body.message || '')
      : '';
    const retryable = response.status === 400
      || response.status === 409
      || errorMessage.includes('Horario no disponible');
    if (!retryable) {
      break;
    }
  }

  const createOk = Boolean(createResponse && createResponse.status >= 200 && createResponse.status < 300);
  const createdAppointmentId =
    createResponse && createResponse.body && typeof createResponse.body === 'object' ? createResponse.body.id : null;

  results.push({
    name: 'auth.appointments.create.valid',
    status: createResponse ? createResponse.status : null,
    ok: createOk,
    responseBody: createResponse ? createResponse.body : null,
  });

  const webhookInvalidBodyResponse = await requestJson({
    baseUrl,
    hostHeader,
    tenantFixture,
    method: 'POST',
    path: '/api/payments/stripe/webhook',
    token: userToken,
  });

  results.push({
    name: 'auth.payments.webhook.invalid-body',
    status: webhookInvalidBodyResponse.status,
    ok: webhookInvalidBodyResponse.status === 400,
    responseBody: webhookInvalidBodyResponse.body,
  });

  await cleanupAppointment({
    baseUrl,
    hostHeader,
    tenantFixture,
    token: userToken,
    appointmentId: createdAppointmentId,
  });

  const stripeAvailability = await requestJson({
    baseUrl,
    hostHeader,
    tenantFixture,
    method: 'GET',
    path: '/api/payments/stripe/availability',
  });

  const stripeEnabled = Boolean(stripeAvailability.body && stripeAvailability.body.enabled === true);
  if (!stripeEnabled) {
    results.push({
      name: 'auth.payments.checkout.valid',
      status: 'SKIP',
      ok: true,
      skipped: true,
      reason: 'stripe_unavailable',
      availability: stripeAvailability.body,
    });

    const crudCapabilityResults = await runCrudCapabilityChecks({
      baseUrl,
      hostHeader,
      tenantFixture,
      adminActor,
      clientUserId,
      bookingCandidates,
    });

    return [...results, ...crudCapabilityResults];
  }

  const checkoutPayload = {
    barberId: bookingPayload.barberId,
    serviceId: bookingPayload.serviceId,
    startDateTime: bookingPayload.startDateTime,
    guestName: 'Smoke Test Checkout',
    guestContact: 'smoke-checkout@example.com',
    privacyConsentGiven: true,
  };

  const checkoutResponse = await requestJson({
    baseUrl,
    hostHeader,
    tenantFixture,
    method: 'POST',
    path: '/api/payments/stripe/checkout',
    token: userToken,
    body: checkoutPayload,
  });

  const checkoutOk = checkoutResponse.status >= 200 && checkoutResponse.status < 300;
  const checkoutAppointmentId =
    checkoutResponse.body && typeof checkoutResponse.body === 'object' ? checkoutResponse.body.appointmentId : null;

  results.push({
    name: 'auth.payments.checkout.valid',
    status: checkoutResponse.status,
    ok: checkoutOk,
    responseBody: checkoutResponse.body,
  });

  await cleanupAppointment({
    baseUrl,
    hostHeader,
    tenantFixture,
    token: userToken,
    appointmentId: checkoutAppointmentId,
  });

  const crudCapabilityResults = await runCrudCapabilityChecks({
    baseUrl,
    hostHeader,
    tenantFixture,
    adminActor,
    clientUserId,
    bookingCandidates,
  });

  return [...results, ...crudCapabilityResults];
};

const waitForStartup = async ({ child, timeoutMs }) => {
  let started = false;

  const handleChunk = (chunk) => {
    const text = chunk.toString();
    if (text.includes('Nest application successfully started')) started = true;
    if (text.includes('PrismaClientInitializationError')) {
      throw new Error('Runtime startup failed: PrismaClientInitializationError');
    }
    if (text.includes('EADDRINUSE')) {
      throw new Error('Runtime startup failed: EADDRINUSE');
    }
  };

  child.stdout.on('data', (chunk) => {
    try {
      handleChunk(chunk);
    } catch (error) {
      child.emit('error', error);
    }
  });
  child.stderr.on('data', (chunk) => {
    try {
      handleChunk(chunk);
    } catch (error) {
      child.emit('error', error);
    }
  });

  const startup = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Startup timeout after ${timeoutMs}ms`)), timeoutMs);
    const cleanup = () => clearTimeout(timeout);

    child.on('error', (error) => {
      cleanup();
      reject(error);
    });
    child.on('exit', (code, signal) => {
      if (started) return;
      cleanup();
      reject(new Error(`Runtime exited before startup (code=${code}, signal=${signal})`));
    });

    const interval = setInterval(() => {
      if (!started) return;
      clearInterval(interval);
      cleanup();
      resolve();
    }, 100);
    interval.unref();
  });

  await startup;
};

const stopChild = async (child) => {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  try {
    await Promise.race([
      once(child, 'exit'),
      wait(4_000).then(() => {
        throw new Error('timeout');
      }),
    ]);
  } catch {
    child.kill('SIGKILL');
    await once(child, 'exit');
  }
};

const main = async () => {
  const { userActor, adminActor, clientUserId, tenantFixture, bookingCandidates } = await pickActors();
  const port = await findFreePort();
  const hostHeader = resolveTenantHostHeader(tenantFixture.subdomain, port);
  const baseUrl = `http://127.0.0.1:${port}`;

  const child = spawn(nodeBin, ['--enable-source-maps', 'dist/main.js'], {
    cwd: backendRoot,
    env: {
      ...process.env,
      PORT: String(port),
      TENANT_ALLOW_HEADER_OVERRIDES: 'true',
      AUTH_DEV_BYPASS_ENABLED: 'true',
      AUTH_DEV_BYPASS_PREFIX: DEV_BYPASS_PREFIX,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForStartup({ child, timeoutMs: STARTUP_TIMEOUT_MS });

    const readResults = await runReadChecks({
      baseUrl,
      hostHeader,
      tenantFixture,
      userActor,
      adminActor,
      bookingCandidates,
    });

    const writeResults = await runWriteChecks({
      baseUrl,
      hostHeader,
      tenantFixture,
      userActor,
      adminActor,
      clientUserId,
      bookingCandidates,
    });

    const results = [...readResults, ...writeResults];
    const checkoutResult = results.find((result) => result.name === 'auth.payments.checkout.valid') || null;
    const failed = results.filter((result) => !result.ok);

    console.log(
      `Authenticated smoke tenant=${tenantFixture.subdomain}/${tenantFixture.localId} ` +
      `actor user=${userActor.id} (${userActor.firebaseUid})` +
      (adminActor?.id ? ` admin=${adminActor.id} (${adminActor.firebaseUid})` : ' admin=none'),
    );
    console.log('Authenticated runtime smoke results:');
    for (const result of results) {
      const status = result.status === null ? 'ERR' : String(result.status);
      const verdict = result.ok ? 'PASS' : 'FAIL';
      const skipSuffix = result.skipped ? ` (skipped:${result.reason || 'true'})` : '';
      const errorSuffix = result.error ? ` (${result.error})` : '';
      console.log(`- ${result.name}: ${verdict} [${status}]${skipSuffix}${errorSuffix}`);
    }

    emitSmokeSummary({
      smokeId: 'runtime-authenticated',
      checkoutResult,
    });
    emitSmokeDetails({
      smokeId: 'runtime-authenticated',
      results,
    });

    if (failed.length > 0) {
      throw new Error(`Authenticated runtime smoke failed in ${failed.length} case(s).`);
    }

    console.log('Authenticated runtime smoke passed.');
  } finally {
    await stopChild(child);
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
