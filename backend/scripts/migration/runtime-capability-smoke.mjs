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

const pickFixture = async () => {
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
      throw new Error('Runtime smoke requires an active brand.');
    }

    const activeLocations = await prisma.location.findMany({
      where: { brandId: brand.id, isActive: true },
      orderBy: [{ createdAt: 'asc' }],
      select: { id: true },
    });
    if (activeLocations.length === 0) {
      throw new Error(`Runtime smoke requires active locations for brand ${brand.subdomain}.`);
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
      throw new Error(`Runtime smoke requires at least one local with barber+service for brand ${brand.subdomain}.`);
    }

    return {
      subdomain: brand.subdomain,
      localId,
      barberIds,
      serviceIds,
    };
  } finally {
    await prisma.$disconnect();
  }
};

const createHeaders = ({ hostHeader, tenantFixture, hasBody }) => {
  const headers = {
    Host: hostHeader,
    Accept: 'application/json',
    'x-local-id': tenantFixture.localId,
    'x-tenant-subdomain': tenantFixture.subdomain,
  };
  if (hasBody) headers['Content-Type'] = 'application/json';
  return headers;
};

const requestJson = async ({
  baseUrl,
  hostHeader,
  tenantFixture,
  method,
  path,
  body,
}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const hasBody = body !== undefined;

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: createHeaders({ hostHeader, tenantFixture, hasBody }),
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

const resolveValidBookingPayload = async ({ baseUrl, hostHeader, tenantFixture }) => {
  const today = formatDateOnly(new Date());

  for (let dayOffset = 0; dayOffset <= 21; dayOffset += 1) {
    const date = addDays(today, dayOffset);

    for (const serviceId of tenantFixture.serviceIds) {
      const params = new URLSearchParams({
        date,
        barberIds: tenantFixture.barberIds.join(','),
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

      for (const barberId of tenantFixture.barberIds) {
        const slots = response.body[barberId];
        if (!Array.isArray(slots) || slots.length === 0) continue;

        const slot = slots[0];
        const startDateTime = new Date(`${date}T${slot}:00`).toISOString();

        return {
          barberId,
          serviceId,
          date,
          slot,
          startDateTime,
        };
      }
    }
  }

  return null;
};

const cleanupAppointment = async ({ baseUrl, hostHeader, tenantFixture, appointmentId }) => {
  if (!appointmentId) return;

  try {
    await requestJson({
      baseUrl,
      hostHeader,
      tenantFixture,
      method: 'DELETE',
      path: `/api/appointments/${encodeURIComponent(appointmentId)}`,
    });
  } catch {
    // best-effort cleanup for runtime smoke data
  }
};

const runRuntimeSmoke = async ({ baseUrl, hostHeader, tenantFixture }) => {
  const results = [];

  const bootstrap = await requestJson({
    baseUrl,
    hostHeader,
    tenantFixture,
    method: 'GET',
    path: '/api/tenant/bootstrap',
  });
  results.push({
    name: 'tenant.bootstrap',
    status: bootstrap.status,
    ok: bootstrap.status >= 200 && bootstrap.status < 300,
  });

  const bookingPayload = await resolveValidBookingPayload({ baseUrl, hostHeader, tenantFixture });
  if (!bookingPayload) {
    results.push({
      name: 'appointments.fixture.resolve',
      status: null,
      ok: false,
      error: 'No booking slot found in next 21 days for runtime smoke.',
    });
    return results;
  }

  const availabilitySingleParams = new URLSearchParams({
    barberId: bookingPayload.barberId,
    date: bookingPayload.date,
    serviceId: bookingPayload.serviceId,
  });
  const availabilitySingle = await requestJson({
    baseUrl,
    hostHeader,
    tenantFixture,
    method: 'GET',
    path: `/api/appointments/availability?${availabilitySingleParams.toString()}`,
  });
  results.push({
    name: 'appointments.availability.single.valid',
    status: availabilitySingle.status,
    ok: availabilitySingle.status >= 200 && availabilitySingle.status < 300,
  });

  const availabilityBatchParams = new URLSearchParams({
    date: bookingPayload.date,
    barberIds: tenantFixture.barberIds.join(','),
    serviceId: bookingPayload.serviceId,
  });
  const availabilityBatch = await requestJson({
    baseUrl,
    hostHeader,
    tenantFixture,
    method: 'GET',
    path: `/api/appointments/availability-batch?${availabilityBatchParams.toString()}`,
  });
  results.push({
    name: 'appointments.availability.batch.valid',
    status: availabilityBatch.status,
    ok: availabilityBatch.status >= 200 && availabilityBatch.status < 300,
  });

  const createResponse = await requestJson({
    baseUrl,
    hostHeader,
    tenantFixture,
    method: 'POST',
    path: '/api/appointments',
    body: {
      barberId: bookingPayload.barberId,
      serviceId: bookingPayload.serviceId,
      startDateTime: bookingPayload.startDateTime,
      guestName: 'Runtime Smoke Create',
      guestContact: 'runtime-smoke-create@example.com',
      privacyConsentGiven: true,
    },
  });

  const createdAppointmentId =
    createResponse.body && typeof createResponse.body === 'object' ? createResponse.body.id : null;

  results.push({
    name: 'appointments.create.valid',
    status: createResponse.status,
    ok: createResponse.status >= 200 && createResponse.status < 300,
  });

  await cleanupAppointment({
    baseUrl,
    hostHeader,
    tenantFixture,
    appointmentId: createdAppointmentId,
  });

  const paymentsAvailability = await requestJson({
    baseUrl,
    hostHeader,
    tenantFixture,
    method: 'GET',
    path: '/api/payments/stripe/availability',
  });
  results.push({
    name: 'payments.availability',
    status: paymentsAvailability.status,
    ok: paymentsAvailability.status >= 200 && paymentsAvailability.status < 300,
  });

  const stripeEnabled = Boolean(paymentsAvailability.body && paymentsAvailability.body.enabled === true);
  if (!stripeEnabled) {
    results.push({
      name: 'payments.checkout.valid',
      status: 'SKIP',
      ok: true,
      skipped: true,
      reason: 'stripe_unavailable',
    });
    return results;
  }

  const checkoutResponse = await requestJson({
    baseUrl,
    hostHeader,
    tenantFixture,
    method: 'POST',
    path: '/api/payments/stripe/checkout',
    body: {
      barberId: bookingPayload.barberId,
      serviceId: bookingPayload.serviceId,
      startDateTime: bookingPayload.startDateTime,
      guestName: 'Runtime Smoke Checkout',
      guestContact: 'runtime-smoke-checkout@example.com',
      privacyConsentGiven: true,
    },
  });

  const checkoutAppointmentId =
    checkoutResponse.body && typeof checkoutResponse.body === 'object' ? checkoutResponse.body.appointmentId : null;

  results.push({
    name: 'payments.checkout.valid',
    status: checkoutResponse.status,
    ok: checkoutResponse.status >= 200 && checkoutResponse.status < 300,
  });

  await cleanupAppointment({
    baseUrl,
    hostHeader,
    tenantFixture,
    appointmentId: checkoutAppointmentId,
  });

  return results;
};

const waitForStartup = async ({ child, timeoutMs }) => {
  let started = false;

  const handleChunk = (chunk) => {
    const text = chunk.toString();

    if (text.includes('Nest application successfully started')) {
      started = true;
    }
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
    const timeout = setTimeout(() => {
      reject(new Error(`Startup timeout after ${timeoutMs}ms`));
    }, timeoutMs);

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
  const tenantFixture = await pickFixture();
  const port = await findFreePort();
  const hostHeader = resolveTenantHostHeader(tenantFixture.subdomain, port);
  const baseUrl = `http://127.0.0.1:${port}`;

  const child = spawn(nodeBin, ['--enable-source-maps', 'dist/main.js'], {
    cwd: backendRoot,
    env: {
      ...process.env,
      PORT: String(port),
      TENANT_ALLOW_HEADER_OVERRIDES: 'true',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForStartup({ child, timeoutMs: STARTUP_TIMEOUT_MS });

    const results = await runRuntimeSmoke({ baseUrl, hostHeader, tenantFixture });
    const checkoutResult = results.find((result) => result.name === 'payments.checkout.valid') || null;
    const failed = results.filter((result) => !result.ok);

    console.log(
      `Runtime smoke tenant=${tenantFixture.subdomain}/${tenantFixture.localId} ` +
      `barbers=${tenantFixture.barberIds.length} services=${tenantFixture.serviceIds.length}`,
    );
    console.log('Runtime smoke results:');
    for (const result of results) {
      const status = result.status === null ? 'ERR' : String(result.status);
      const verdict = result.ok ? 'PASS' : 'FAIL';
      const skipSuffix = result.skipped ? ` (skipped:${result.reason || 'true'})` : '';
      const errorSuffix = result.error ? ` (${result.error})` : '';
      console.log(`- ${result.name}: ${verdict} [${status}]${skipSuffix}${errorSuffix}`);
    }

    emitSmokeSummary({
      smokeId: 'runtime-capability',
      checkoutResult,
    });
    emitSmokeDetails({
      smokeId: 'runtime-capability',
      results,
    });

    if (failed.length > 0) {
      throw new Error(`Runtime smoke failed in ${failed.length} case(s).`);
    }

    console.log('Runtime capability smoke passed.');
  } finally {
    await stopChild(child);
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
