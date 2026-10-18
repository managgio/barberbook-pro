import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { HmacGuestAppointmentAccessTokenAdapter } from '@/contexts/booking/infrastructure/adapters/hmac-guest-appointment-access-token.adapter';
import { GetGuestAppointmentAccessUseCase } from '@/contexts/booking/application/use-cases/get-guest-appointment-access.use-case';
import { CancelGuestAppointmentUseCase } from '@/contexts/booking/application/use-cases/cancel-guest-appointment.use-case';
import {
  GuestAppointmentAccessNotFoundError,
  GuestAppointmentCannotCancelError,
} from '@/contexts/booking/application/errors/guest-appointment-access.errors';
import { BookingGuestAppointmentRecord } from '@/contexts/booking/ports/outbound/guest-appointment-read.port';

const SECRET = 'guest-link-test-secret-with-at-least-32-bytes';
const TOKEN_NOW = new Date('2026-10-18T10:00:00.000Z');
const TOKEN_EXPIRES_AT = new Date('2026-10-22T10:00:00.000Z');
const context = {
  tenantId: 'brand-1',
  brandId: 'brand-1',
  localId: 'local-1',
  actorUserId: null,
  timezone: 'Europe/Madrid',
  correlationId: 'corr-1',
};
const futureAppointment = {
  id: 'appointment_1234567890',
  status: 'scheduled' as const,
  startDateTime: new Date('2026-10-20T10:00:00.000Z'),
  durationMinutes: 60,
  serviceName: 'Corte + Barba',
  professionalName: 'Alex',
};

test('guest access HMAC rejects tampering and a token replayed in another tenant', () => {
  const adapter = new HmacGuestAppointmentAccessTokenAdapter({ secret: SECRET, now: () => TOKEN_NOW });
  const token = adapter.createToken({
    brandId: context.brandId,
    localId: context.localId,
    appointmentId: futureAppointment.id,
    expiresAt: TOKEN_EXPIRES_AT,
  });
  assert.ok(token);
  assert.deepEqual(
    adapter.resolveToken({ ...context, token: token! }),
    { status: 'valid', appointmentId: futureAppointment.id },
  );

  const tampered = token!.replace(futureAppointment.id, 'appointment_9999999999');
  assert.deepEqual(adapter.resolveToken({ ...context, token: tampered }), { status: 'invalid' });
  assert.deepEqual(
    adapter.resolveToken({
      brandId: 'brand-2',
      localId: 'local-2',
      token: token!,
    }),
    { status: 'invalid' },
  );
});

test('guest access HMAC fails closed without a strong secret', () => {
  const adapter = new HmacGuestAppointmentAccessTokenAdapter({ secret: '' });
  assert.equal(adapter.createToken({
    brandId: context.brandId,
    localId: context.localId,
    appointmentId: futureAppointment.id,
    expiresAt: TOKEN_EXPIRES_AT,
  }), null);
  assert.deepEqual(adapter.resolveToken({ ...context, token: 'v1.invalid.invalid' }), {
    status: 'unavailable',
  });
  assert.throws(
    () => new HmacGuestAppointmentAccessTokenAdapter({ secret: 'short', production: true }),
    /GUEST_APPOINTMENT_LINK_SECRET/,
  );
});

test('guest access HMAC rejects an expired signed token', () => {
  const issuer = new HmacGuestAppointmentAccessTokenAdapter({
    secret: SECRET,
    now: () => TOKEN_NOW,
  });
  const token = issuer.createToken({
    brandId: context.brandId,
    localId: context.localId,
    appointmentId: futureAppointment.id,
    expiresAt: new Date('2026-10-18T11:00:00.000Z'),
  });
  assert.ok(token);

  const verifier = new HmacGuestAppointmentAccessTokenAdapter({
    secret: SECRET,
    now: () => new Date('2026-10-18T11:00:01.000Z'),
  });
  assert.deepEqual(verifier.resolveToken({ ...context, token: token! }), { status: 'invalid' });
});

test('guest summary exposes only operational appointment fields', async () => {
  const tokenPort = new HmacGuestAppointmentAccessTokenAdapter({ secret: SECRET, now: () => TOKEN_NOW });
  const token = tokenPort.createToken({
    brandId: context.brandId,
    localId: context.localId,
    appointmentId: futureAppointment.id,
    expiresAt: TOKEN_EXPIRES_AT,
  })!;
  const readCalls: any[] = [];
  const useCase = new GetGuestAppointmentAccessUseCase(
    tokenPort,
    {
      findGuestAppointment: async (params) => {
        readCalls.push(params);
        return futureAppointment;
      },
      getCancellationCutoffHours: async () => 24,
    },
    { now: () => new Date('2026-10-18T10:00:00.000Z') },
  );

  const summary = await useCase.execute({ context, token });

  assert.deepEqual(readCalls, [{ localId: 'local-1', appointmentId: futureAppointment.id }]);
  assert.deepEqual(summary, {
    status: 'scheduled',
    startDateTime: '2026-10-20T10:00:00.000Z',
    durationMinutes: 60,
    serviceName: 'Corte + Barba',
    professionalName: 'Alex',
    timezone: 'Europe/Madrid',
    canCancel: true,
    cancellationUnavailableReason: null,
  });
  assert.equal('guestName' in summary, false);
  assert.equal('guestEmail' in summary, false);
  assert.equal('guestPhone' in summary, false);
  assert.equal('appointmentId' in summary, false);
});

test('guest cancellation reuses the appointment update use case and is idempotent', async () => {
  const tokenPort = new HmacGuestAppointmentAccessTokenAdapter({ secret: SECRET, now: () => TOKEN_NOW });
  const token = tokenPort.createToken({
    brandId: context.brandId,
    localId: context.localId,
    appointmentId: futureAppointment.id,
    expiresAt: TOKEN_EXPIRES_AT,
  })!;
  let appointment: BookingGuestAppointmentRecord = { ...futureAppointment };
  const updates: any[] = [];
  const useCase = new CancelGuestAppointmentUseCase(
    tokenPort,
    {
      findGuestAppointment: async () => appointment,
      getCancellationCutoffHours: async () => 12,
    },
    {
      execute: async (command: any) => {
        updates.push(command);
        appointment = { ...appointment, status: 'cancelled' as const };
        return appointment;
      },
    } as any,
    { now: () => new Date('2026-10-18T10:00:00.000Z') },
    {
      runWithLock: async (_key, work) => {
        await work();
        return true;
      },
    },
  );

  const first = await useCase.execute({ context, token });
  const repeated = await useCase.execute({ context, token });

  assert.equal(first.status, 'cancelled');
  assert.equal(repeated.status, 'cancelled');
  assert.equal(updates.length, 1);
  assert.equal(updates[0].appointmentId, futureAppointment.id);
  assert.equal(updates[0].input.status, 'cancelled');
  assert.equal(updates[0].execution.actorUserId, null);
});

test('guest cancellation respects start time and tenant cancellation cutoff', async () => {
  const tokenPort = new HmacGuestAppointmentAccessTokenAdapter({ secret: SECRET, now: () => TOKEN_NOW });
  const token = tokenPort.createToken({
    brandId: context.brandId,
    localId: context.localId,
    appointmentId: futureAppointment.id,
    expiresAt: TOKEN_EXPIRES_AT,
  })!;
  const useCase = new CancelGuestAppointmentUseCase(
    tokenPort,
    {
      findGuestAppointment: async () => futureAppointment,
      getCancellationCutoffHours: async () => 48,
    },
    { execute: async () => assert.fail('update must not run') } as any,
    { now: () => new Date('2026-10-18T10:00:00.000Z') },
    {
      runWithLock: async (_key, work) => {
        await work();
        return true;
      },
    },
  );

  await assert.rejects(
    useCase.execute({ context, token }),
    (error: unknown) =>
      error instanceof GuestAppointmentCannotCancelError
      && error.reason === 'cancellation_cutoff_reached',
  );
});

test('guest cancellation rejects an appointment that is no longer scheduled', async () => {
  const tokenPort = new HmacGuestAppointmentAccessTokenAdapter({ secret: SECRET, now: () => TOKEN_NOW });
  const token = tokenPort.createToken({
    brandId: context.brandId,
    localId: context.localId,
    appointmentId: futureAppointment.id,
    expiresAt: TOKEN_EXPIRES_AT,
  })!;
  const useCase = new CancelGuestAppointmentUseCase(
    tokenPort,
    {
      findGuestAppointment: async () => ({ ...futureAppointment, status: 'completed' }),
      getCancellationCutoffHours: async () => 0,
    },
    { execute: async () => assert.fail('update must not run') } as any,
    { now: () => TOKEN_NOW },
    {
      runWithLock: async (_key, work) => {
        await work();
        return true;
      },
    },
  );

  await assert.rejects(
    useCase.execute({ context, token }),
    (error: unknown) =>
      error instanceof GuestAppointmentCannotCancelError
      && error.reason === 'appointment_not_scheduled',
  );
});

test('guest access never queries a tenant with a token signed for another tenant', async () => {
  const tokenPort = new HmacGuestAppointmentAccessTokenAdapter({ secret: SECRET, now: () => TOKEN_NOW });
  const token = tokenPort.createToken({
    brandId: context.brandId,
    localId: context.localId,
    appointmentId: futureAppointment.id,
    expiresAt: TOKEN_EXPIRES_AT,
  })!;
  let queried = false;
  const useCase = new GetGuestAppointmentAccessUseCase(
    tokenPort,
    {
      findGuestAppointment: async () => {
        queried = true;
        return futureAppointment;
      },
      getCancellationCutoffHours: async () => 0,
    },
    { now: () => new Date('2026-10-18T10:00:00.000Z') },
  );

  await assert.rejects(
    useCase.execute({
      context: { ...context, brandId: 'brand-2', localId: 'local-2' },
      token,
    }),
    GuestAppointmentAccessNotFoundError,
  );
  assert.equal(queried, false);
});
