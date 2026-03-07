import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { ModuleBookingCommandAdapter } from '@/modules/appointments/adapters/module-booking-command.adapter';

const commandContext = {
  tenantId: 'tenant-1',
  brandId: 'brand-1',
  localId: 'local-1',
  actorUserId: null,
  timezone: 'Europe/Madrid',
  correlationId: 'corr-1',
};

const createdAppointment = {
  id: 'appt-1',
  localId: 'local-1',
  userId: 'user-1',
  barberId: 'barber-1',
  barberNameSnapshot: 'Barbero',
  serviceId: 'service-1',
  serviceNameSnapshot: 'Corte',
  loyaltyProgramId: null,
  loyaltyRewardApplied: false,
  referralAttributionId: null,
  appliedCouponId: null,
  walletAppliedAmount: new Prisma.Decimal(0),
  subscriptionApplied: false,
  subscriptionPlanId: null,
  subscriptionId: null,
  startDateTime: new Date('2026-01-10T10:00:00.000Z'),
  price: new Prisma.Decimal(20),
  paymentMethod: null,
  paymentStatus: 'in_person',
  paymentAmount: new Prisma.Decimal(20),
  paymentCurrency: 'eur',
  paymentPaidAt: null,
  paymentExpiresAt: null,
  status: 'scheduled',
  notes: null,
  guestName: null,
  guestContact: null,
  reminderSent: false,
  anonymizedAt: null,
  stripePaymentIntentId: null,
  stripeCheckoutSessionId: null,
  createdAt: new Date('2026-01-01T10:00:00.000Z'),
  updatedAt: new Date('2026-01-01T10:00:00.000Z'),
  user: null,
  barber: { name: 'Barbero' },
  service: { name: 'Corte' },
  products: [],
} as any;

const buildAdapter = (overrides?: {
  prisma?: any;
  auditLogs?: any;
  sideEffects?: any;
  settingsService?: any;
  schedulesService?: any;
  notificationsService?: any;
  barbersService?: any;
  legalService?: any;
  getAvailabilityUseCase?: any;
  servicePricing?: any;
  subscriptionPolicy?: any;
  loyaltyPolicy?: any;
  walletLedger?: any;
  referralAttribution?: any;
}) =>
  new ModuleBookingCommandAdapter(
    overrides?.prisma ??
      ({
        appointment: {
          findFirst: async () => null,
        },
        service: {
          findFirst: async () => ({ id: 'service-1', duration: 30, name: 'Corte' }),
        },
        barber: {
          findFirst: async () => ({ id: 'barber-1', name: 'Barbero' }),
        },
        offer: {
          findMany: async () => [],
        },
        product: {
          findMany: async () => [],
        },
        $transaction: async (cb: any) =>
          cb({
            appointment: {
              findMany: async () => [],
              create: async () => createdAppointment,
              update: async () => createdAppointment,
              delete: async () => undefined,
            },
            product: {
              update: async () => undefined,
            },
          }),
      } as any),
    overrides?.auditLogs ?? ({ log: async () => undefined } as any),
    overrides?.sideEffects ?? ({ execute: async () => ({ failures: [] }) } as any),
    overrides?.settingsService ??
      ({
        getSettings: async () => ({
          products: { enabled: true, clientPurchaseEnabled: true },
          appointments: { cancellationCutoffHours: 0 },
        }),
      } as any),
    overrides?.schedulesService ?? ({ getShopSchedule: async () => ({ bufferMinutes: 0 }) } as any),
    overrides?.notificationsService ?? ({ sendAppointmentEmail: async () => undefined } as any),
    overrides?.barbersService ?? ({ assertBarberCanProvideService: async () => undefined } as any),
    overrides?.legalService ??
      ({
        hasUserPrivacyConsent: async () => false,
        recordPrivacyConsent: async () => undefined,
      } as any),
    overrides?.getAvailabilityUseCase ?? ({ execute: async () => ['11:00'] } as any),
    overrides?.servicePricing ??
      ({
        calculateServicePrice: async () => ({
          serviceName: 'Corte',
          finalPrice: 20,
        }),
      } as any),
    overrides?.subscriptionPolicy ?? ({ resolveActiveSubscriptionForAppointment: async () => null } as any),
    overrides?.loyaltyPolicy ?? ({ resolveRewardDecision: async () => null } as any),
    overrides?.walletLedger ??
      ({
        validateCoupon: async () => {
          throw new Error('unused');
        },
        calculateCouponDiscount: () => 0,
        getAvailableBalance: async () => 0,
        reserveWalletHold: async () => undefined,
        reserveCouponUsage: async () => undefined,
      } as any),
    overrides?.referralAttribution ??
      ({
        resolveAttributionForBooking: async () => null,
        attachAttributionToAppointment: async () => undefined,
      } as any),
  );

test('create appointment command adapter rejects booking when consent is missing', async () => {
  const adapter = buildAdapter();

  await assert.rejects(
    adapter.createAppointment({
      context: commandContext,
      input: {
        barberId: 'barber-1',
        serviceId: 'service-1',
        startDateTime: '2026-01-10T10:00:00.000Z',
        privacyConsentGiven: false,
      },
      execution: { requireConsent: true },
    } as any),
    /Se requiere aceptar la politica de privacidad/,
  );
});

test('create appointment command adapter records consent when provided', async () => {
  let consentRecorded = false;
  const adapter = buildAdapter({
    legalService: {
      hasUserPrivacyConsent: async () => false,
      recordPrivacyConsent: async () => {
        consentRecorded = true;
      },
    } as any,
  });

  const result = await adapter.createAppointment({
    context: commandContext,
    input: {
      userId: 'user-1',
      barberId: 'barber-1',
      serviceId: 'service-1',
      startDateTime: '2026-01-10T10:00:00.000Z',
      privacyConsentGiven: true,
      useWallet: false,
    },
    execution: {
      requireConsent: true,
      actorUserId: null,
    },
  } as any);

  assert.equal((result as any).id, 'appt-1');
  assert.equal(consentRecorded, true);
});

test('remove appointment command adapter executes side effects, restocks and deletes', async () => {
  const sideEffectCalls: Array<{ localId: string; appointmentId: string; nextStatus: string }> = [];
  const stockUpdates: Array<{ id: string; increment: number }> = [];
  const deleteCalls: string[] = [];
  const auditCalls: any[] = [];

  const adapter = buildAdapter({
    prisma: {
      appointment: {
        findFirst: async () => ({
          id: 'appt-1',
          status: 'scheduled',
          products: [{ productId: 'prod-1', quantity: 2 }],
        }),
      },
      $transaction: async (cb: any) =>
        cb({
          product: {
            update: async (params: any) => {
              stockUpdates.push({
                id: params.where.id,
                increment: params.data.stock.increment,
              });
            },
          },
          appointment: {
            delete: async (params: any) => {
              deleteCalls.push(params.where.id);
            },
          },
        }),
    } as any,
    auditLogs: {
      log: async (entry: any) => {
        auditCalls.push(entry);
      },
    } as any,
    sideEffects: {
      execute: async (command: any) => {
        sideEffectCalls.push(command);
        return { failures: [] };
      },
    } as any,
  });

  const result = await adapter.removeAppointment({
    context: commandContext,
    appointmentId: 'appt-1',
  });

  assert.deepEqual(result, { success: true });
  assert.deepEqual(sideEffectCalls, [
    {
      localId: 'local-1',
      appointmentId: 'appt-1',
      nextStatus: 'cancelled',
    },
  ]);
  assert.deepEqual(stockUpdates, [{ id: 'prod-1', increment: 2 }]);
  assert.deepEqual(deleteCalls, ['appt-1']);
  assert.equal(auditCalls.length, 1);
  assert.equal(auditCalls[0].action, 'appointment.deleted');
  assert.equal(auditCalls[0].entityId, 'appt-1');
  assert.equal(auditCalls[0].locationId, 'local-1');
});

test('remove appointment command adapter throws when appointment does not exist', async () => {
  const adapter = buildAdapter({
    prisma: {
      appointment: {
        findFirst: async () => null,
      },
      $transaction: async () => undefined,
    } as any,
  });

  await assert.rejects(
    adapter.removeAppointment({
      context: commandContext,
      appointmentId: 'missing',
    }),
    /Appointment not found/,
  );
});

test('update appointment command adapter updates via prisma path', async () => {
  const updated = {
    ...createdAppointment,
    notes: 'nota nueva',
  } as any;

  let transactionCalled = false;
  const adapter = buildAdapter({
    prisma: {
      appointment: {
        findFirst: async () => ({
          ...createdAppointment,
          notes: 'nota vieja',
          serviceNameSnapshot: 'Corte',
          barberNameSnapshot: 'Barbero',
          products: [],
        }),
      },
      service: {
        findFirst: async () => ({ duration: 30, name: 'Corte', id: 'service-1' }),
      },
      offer: {
        findMany: async () => [],
      },
      product: {
        findMany: async () => [],
      },
      $transaction: async (cb: any) => {
        transactionCalled = true;
        return cb({
          appointment: {
            findMany: async () => [],
            update: async () => updated,
          },
          product: {
            update: async () => undefined,
          },
        });
      },
    } as any,
  });

  const result = await adapter.updateAppointment({
    context: commandContext,
    appointmentId: 'appt-1',
    input: {
      notes: 'nota nueva',
    },
    execution: {
      actorUserId: null,
    },
  } as any);

  assert.equal(transactionCalled, true);
  assert.equal((result as any).id, 'appt-1');
  assert.equal((result as any).notes, 'nota nueva');
});
