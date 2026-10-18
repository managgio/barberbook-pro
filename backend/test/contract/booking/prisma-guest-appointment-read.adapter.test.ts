import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { PrismaGuestAppointmentReadAdapter } from '@/modules/appointments/adapters/prisma-guest-appointment-read.adapter';

test('guest appointment read adapter scopes by local and guest ownership without selecting PII', async () => {
  let query: any = null;
  const adapter = new PrismaGuestAppointmentReadAdapter(
    {
      appointment: {
        findFirst: async (args: any) => {
          query = args;
          return {
            id: 'appointment-1',
            status: 'scheduled',
            startDateTime: new Date('2026-10-20T10:00:00.000Z'),
            totalDurationMinutes: 60,
            serviceNameSnapshot: 'Corte + Barba',
            barberNameSnapshot: 'Alex',
            service: { name: 'Corte', duration: 30 },
            barber: { name: 'Alex' },
            serviceItems: [
              { nameSnapshot: 'Corte', durationMinutes: 30 },
              { nameSnapshot: 'Barba', durationMinutes: 30 },
            ],
          };
        },
      },
    } as any,
    { getSettings: async () => ({ appointments: { cancellationCutoffHours: 24 } }) } as any,
  );

  const result = await adapter.findGuestAppointment({
    localId: 'local-1',
    appointmentId: 'appointment-1',
  });

  assert.deepEqual(query.where, {
    id: 'appointment-1',
    localId: 'local-1',
    userId: null,
  });
  assert.equal(query.select.guestName, undefined);
  assert.equal(query.select.guestEmail, undefined);
  assert.equal(query.select.guestPhone, undefined);
  assert.equal(result?.serviceName, 'Corte + Barba');
  assert.equal(result?.durationMinutes, 60);
  assert.equal(await adapter.getCancellationCutoffHours(), 24);
});
