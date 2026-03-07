import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { ModuleBookingMaintenanceAdapter } from '@/modules/appointments/adapters/module-booking-maintenance.adapter';

const requestContext = {
  tenantId: 'tenant-1',
  brandId: 'brand-1',
  localId: 'local-1',
  actorUserId: null,
  timezone: 'Europe/Madrid',
  correlationId: 'corr-1',
};

test('maintenance adapter anonymizes appointment and writes audit log', async () => {
  const auditEntries: any[] = [];
  const adapter = new ModuleBookingMaintenanceAdapter(
    {
      appointment: {
        findFirst: async ({ where }: any) => {
          if (where?.id === 'appt-1') {
            return {
              id: 'appt-1',
              userId: null,
              guestName: 'Nombre',
              guestContact: 'mail@test.com',
            };
          }
          return null;
        },
        update: async () => ({
          id: 'appt-1',
          userId: null,
          barberId: 'barber-1',
          serviceId: 'service-1',
          status: 'scheduled',
          price: 0,
          startDateTime: new Date('2026-01-01T10:00:00.000Z'),
          barberNameSnapshot: null,
          serviceNameSnapshot: null,
          loyaltyProgramId: null,
          loyaltyRewardApplied: false,
          referralAttributionId: null,
          appliedCouponId: null,
          walletAppliedAmount: 0,
          subscriptionApplied: false,
          subscriptionPlanId: null,
          subscriptionId: null,
          paymentMethod: null,
          paymentStatus: null,
          paymentAmount: null,
          paymentCurrency: null,
          paymentPaidAt: null,
          paymentExpiresAt: null,
          guestName: 'Invitado anonimizado',
          guestContact: 'anonimo+appt-1@example.invalid',
          notes: null,
          anonymizedAt: new Date(),
          products: [],
        }),
      },
    } as any,
    {
      log: async (entry: any) => {
        auditEntries.push(entry);
      },
    } as any,
    {
      sendAppointmentEmail: async () => undefined,
    } as any,
    {
      execute: async () => ({ failures: [] }),
    } as any,
    {
      getRequestContext: () => requestContext,
    } as any,
  );

  const result = await adapter.anonymizeAppointment({
    appointmentId: 'appt-1',
    actorUserId: 'admin-1',
    reason: 'retention',
  });

  assert.equal((result as any).id, 'appt-1');
  assert.equal(auditEntries.length, 1);
  assert.equal(auditEntries[0].action, 'appointment.anonymized');
  assert.equal(auditEntries[0].entityId, 'appt-1');
  assert.equal(auditEntries[0].locationId, 'local-1');
});

test('maintenance adapter throws on anonymize when appointment is missing', async () => {
  const adapter = new ModuleBookingMaintenanceAdapter(
    {
      appointment: {
        findFirst: async () => null,
      },
    } as any,
    {
      log: async () => undefined,
    } as any,
    {
      sendAppointmentEmail: async () => undefined,
    } as any,
    {
      execute: async () => ({ failures: [] }),
    } as any,
    {
      getRequestContext: () => requestContext,
    } as any,
  );

  await assert.rejects(
    adapter.anonymizeAppointment({
      appointmentId: 'missing',
    }),
    /Appointment not found/,
  );
});

test('maintenance adapter syncs statuses and triggers side effects for completed ones', async () => {
  const statusUpdates: any[] = [];
  const sideEffectCalls: any[] = [];
  const adapter = new ModuleBookingMaintenanceAdapter(
    {
      appointment: {
        findMany: async () => [
          {
            id: 'appt-past',
            status: 'scheduled',
            startDateTime: new Date('2020-01-01T10:00:00.000Z'),
            service: { duration: 30 },
          },
          {
            id: 'appt-future',
            status: 'scheduled',
            startDateTime: new Date('2999-01-01T10:00:00.000Z'),
            service: { duration: 30 },
          },
        ],
        update: async (params: any) => {
          statusUpdates.push(params);
          return params;
        },
      },
    } as any,
    {
      log: async () => undefined,
    } as any,
    {
      sendAppointmentEmail: async () => undefined,
    } as any,
    {
      execute: async (command: any) => {
        sideEffectCalls.push(command);
        return { failures: [] };
      },
    } as any,
    {
      getRequestContext: () => requestContext,
    } as any,
  );

  const result = await adapter.syncStatusesForAllAppointments();
  assert.equal(result, 1);
  assert.equal(statusUpdates.length, 1);
  assert.equal(statusUpdates[0].where.id, 'appt-past');
  assert.equal(statusUpdates[0].data.status, 'completed');
  assert.deepEqual(sideEffectCalls, [
    {
      localId: 'local-1',
      appointmentId: 'appt-past',
      nextStatus: 'completed',
    },
  ]);
});

test('maintenance adapter sends payment confirmation email when appointment exists', async () => {
  const emailCalls: any[] = [];
  const adapter = new ModuleBookingMaintenanceAdapter(
    {
      appointment: {
        findFirst: async () => ({
          id: 'appt-1',
          startDateTime: new Date('2026-01-01T10:00:00.000Z'),
          guestName: null,
          guestContact: null,
          user: { email: 'user@example.com', phone: null, name: 'User', notificationEmail: true },
          barber: { name: 'Ana' },
          service: { name: 'Corte' },
        }),
      },
    } as any,
    {
      log: async () => undefined,
    } as any,
    {
      sendAppointmentEmail: async (...args: any[]) => {
        emailCalls.push(args);
      },
    } as any,
    {
      execute: async () => ({ failures: [] }),
    } as any,
    {
      getRequestContext: () => requestContext,
    } as any,
  );

  await adapter.sendPaymentConfirmation({ appointmentId: 'appt-1', localId: 'local-1' });
  assert.equal(emailCalls.length, 1);
  assert.equal(emailCalls[0][2], 'creada');
});
