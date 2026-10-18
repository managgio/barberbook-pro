import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { GuestAppointmentLinkService } from '@/modules/guest-appointment-access/guest-appointment-link.service';
import { TENANT_BASE_DOMAIN } from '@/tenancy/tenant.constants';

const requestContext = {
  tenantId: 'brand-1',
  brandId: 'brand-1',
  localId: 'local-1',
  actorUserId: null,
  timezone: 'Europe/Madrid',
  correlationId: 'corr-1',
};

test('guest appointment link uses the tenant custom domain and only resolves guest appointments', async () => {
  let query: any = null;
  let tokenArgs: any = null;
  const service = new GuestAppointmentLinkService(
    {
      appointment: {
        findFirst: async (args: any) => {
          query = args;
          return {
            startDateTime: new Date('2026-10-20T10:00:00.000Z'),
            local: {
              brand: { customDomain: 'reservas.example.com', subdomain: 'tenant-one' },
            },
          };
        },
      },
    } as any,
    { getRequestContext: () => requestContext } as any,
    {
      createToken: (params: any) => {
        tokenArgs = params;
        return 'v1.appointment_1234567890.expiry.signature1234567890';
      },
      resolveToken: () => ({ status: 'invalid' }),
    },
  );

  const url = await service.createManagementUrl('appointment_1234567890');

  assert.equal(url, 'https://reservas.example.com/cita/v1.appointment_1234567890.expiry.signature1234567890');
  assert.deepEqual(query.where, {
    id: 'appointment_1234567890',
    localId: 'local-1',
    userId: null,
    local: { brandId: 'brand-1' },
  });
  assert.equal(tokenArgs.expiresAt.toISOString(), '2026-10-22T10:00:00.000Z');
});

test('guest appointment link fails closed when appointment or signing secret is unavailable', async () => {
  const missingAppointment = new GuestAppointmentLinkService(
    { appointment: { findFirst: async () => null } } as any,
    { getRequestContext: () => requestContext } as any,
    { createToken: () => 'token', resolveToken: () => ({ status: 'invalid' }) },
  );
  assert.equal(await missingAppointment.createManagementUrl('appointment_1234567890'), null);

  const missingSigner = new GuestAppointmentLinkService(
    {
      appointment: {
        findFirst: async () => ({
          startDateTime: new Date('2026-10-20T10:00:00.000Z'),
          local: { brand: { customDomain: null, subdomain: 'tenant-one' } },
        }),
      },
    } as any,
    { getRequestContext: () => requestContext } as any,
    { createToken: () => null, resolveToken: () => ({ status: 'unavailable' }) },
  );
  assert.equal(await missingSigner.createManagementUrl('appointment_1234567890'), null);
});

test('guest appointment link falls back to the tenant subdomain', () => {
  const service = new GuestAppointmentLinkService(
    {} as any,
    { getRequestContext: () => requestContext } as any,
    {
      createToken: () => 'v1.appointment_1234567890.expiry.signature1234567890',
      resolveToken: () => ({ status: 'invalid' }),
    },
  );

  const url = service.createManagementUrlForGuestAppointment({
    appointmentId: 'appointment_1234567890',
    startDateTime: new Date('2026-10-20T10:00:00.000Z'),
    customDomain: null,
    subdomain: 'tenant-one',
  });

  const protocol = TENANT_BASE_DOMAIN.includes('localhost') ? 'http' : 'https';
  assert.equal(
    url,
    `${protocol}://tenant-one.${TENANT_BASE_DOMAIN}/cita/v1.appointment_1234567890.expiry.signature1234567890`,
  );
});
