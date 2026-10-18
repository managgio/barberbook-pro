import * as assert from 'node:assert/strict';
import { AddressInfo } from 'node:net';
import { test } from 'node:test';
import { Test } from '@nestjs/testing';
import { CancelGuestAppointmentUseCase } from '@/contexts/booking/application/use-cases/cancel-guest-appointment.use-case';
import { GuestAppointmentAccessNotFoundError } from '@/contexts/booking/application/errors/guest-appointment-access.errors';
import { GetGuestAppointmentAccessUseCase } from '@/contexts/booking/application/use-cases/get-guest-appointment-access.use-case';
import { TENANT_CONTEXT_PORT } from '@/contexts/platform/ports/outbound/tenant-context.port';
import { GuestAppointmentAccessController } from '@/modules/appointments/guest-appointment-access.controller';

test('guest appointment HTTP responses never cache or forward the bearer URL as referrer', async () => {
  const context = {
    tenantId: 'brand-1',
    brandId: 'brand-1',
    localId: 'local-1',
    actorUserId: null,
    timezone: 'Europe/Madrid',
    correlationId: 'corr-1',
  };
  const summary = {
    status: 'scheduled',
    startDateTime: '2026-10-20T10:00:00.000Z',
    durationMinutes: 30,
    serviceName: 'Corte',
    professionalName: 'Alex',
    timezone: 'Europe/Madrid',
    canCancel: true,
    cancellationUnavailableReason: null,
  };
  const moduleRef = await Test.createTestingModule({
    controllers: [GuestAppointmentAccessController],
    providers: [
      {
        provide: GetGuestAppointmentAccessUseCase,
        useValue: {
          execute: async ({ token }: { token: string }) => {
            if (token === 'missing-token') throw new GuestAppointmentAccessNotFoundError();
            return summary;
          },
        },
      },
      {
        provide: CancelGuestAppointmentUseCase,
        useValue: { execute: async () => ({ ...summary, status: 'cancelled', canCancel: false }) },
      },
      {
        provide: TENANT_CONTEXT_PORT,
        useValue: { getRequestContext: () => context },
      },
    ],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');

  try {
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    const endpoint = `http://127.0.0.1:${address.port}/api/appointments/guest-access`;

    const summaryResponse = await fetch(`${endpoint}/valid-token`);
    assert.equal(summaryResponse.status, 200);
    assert.equal(summaryResponse.headers.get('cache-control'), 'no-store, max-age=0');
    assert.equal(summaryResponse.headers.get('referrer-policy'), 'no-referrer');
    assert.deepEqual(await summaryResponse.json(), summary);

    const cancelResponse = await fetch(`${endpoint}/valid-token/cancel`, { method: 'POST' });
    assert.equal(cancelResponse.status, 200);
    assert.equal(cancelResponse.headers.get('cache-control'), 'no-store, max-age=0');
    assert.equal(cancelResponse.headers.get('referrer-policy'), 'no-referrer');

    const missingResponse = await fetch(`${endpoint}/missing-token`);
    assert.equal(missingResponse.status, 404);
    assert.equal(missingResponse.headers.get('cache-control'), 'no-store, max-age=0');
    assert.equal(missingResponse.headers.get('referrer-policy'), 'no-referrer');
  } finally {
    await app.close();
  }
});
