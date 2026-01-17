import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { AppointmentsService } from '../src/modules/appointments/appointments.service';

const buildService = (options?: { hasConsent?: boolean }) => {
  const hasConsent = options?.hasConsent ?? false;
  const prisma = {
    service: {
      findFirst: async () => ({
        id: 'service-1',
        price: new Prisma.Decimal(20),
        duration: 30,
      }),
    },
    offer: {
      findMany: async () => [],
    },
    appointment: {
      create: async () => ({
        id: 'appointment-1',
        localId: 'local-1',
        userId: null,
        barberId: 'barber-1',
        serviceId: 'service-1',
        startDateTime: new Date('2024-01-02T10:00:00Z'),
        price: new Prisma.Decimal(20),
        status: 'scheduled',
        notes: null,
        guestName: 'Invitado',
        guestContact: 'guest@example.com',
        reminderSent: false,
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:00:00Z'),
        user: null,
        barber: { name: 'Barbero' },
        service: { name: 'Corte', duration: 30 },
      }),
    },
  } as any;

  const holidaysService = {} as any;
  const schedulesService = {} as any;
  const notificationsService = { sendAppointmentEmail: async () => undefined } as any;
  const auditLogs = { log: async () => undefined } as any;
  let consentCalled = false;
  const legalService = {
    recordPrivacyConsent: async () => {
      consentCalled = true;
    },
    hasUserPrivacyConsent: async () => hasConsent,
  } as any;

  return {
    service: new AppointmentsService(
      prisma,
      holidaysService,
      schedulesService,
      notificationsService,
      legalService,
      auditLogs,
    ),
    getConsentCalled: () => consentCalled,
  };
};

test('rejects booking when consent is missing', async () => {
  const { service } = buildService();
  await assert.rejects(
    () =>
      service.create(
        {
          barberId: 'barber-1',
          serviceId: 'service-1',
          startDateTime: '2024-01-02T10:00:00Z',
          privacyConsentGiven: false,
        },
        { requireConsent: true },
      ),
    {
      message: 'Se requiere aceptar la politica de privacidad.',
    },
  );
});

test('creates booking when consent is provided', async () => {
  const { service, getConsentCalled } = buildService();
  const appointment = await service.create(
    {
      barberId: 'barber-1',
      serviceId: 'service-1',
      startDateTime: '2024-01-02T10:00:00Z',
      privacyConsentGiven: true,
    },
    { requireConsent: true },
  );
  assert.equal(appointment.id, 'appointment-1');
  assert.equal(getConsentCalled(), true);
});

test('allows booking when user already consented to current policy', async () => {
  const { service, getConsentCalled } = buildService({ hasConsent: true });
  const appointment = await service.create(
    {
      userId: 'user-1',
      barberId: 'barber-1',
      serviceId: 'service-1',
      startDateTime: '2024-01-02T10:00:00Z',
      privacyConsentGiven: false,
    },
    { requireConsent: true },
  );
  assert.equal(appointment.id, 'appointment-1');
  assert.equal(getConsentCalled(), false);
});
