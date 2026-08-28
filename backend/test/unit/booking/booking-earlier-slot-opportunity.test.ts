import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { findFirstEarlierSlot } from '@/contexts/booking/domain/services/earlier-slot-opportunity.policy';
import { NotifyEarlierSlotOpportunityUseCase } from '@/contexts/booking/application/use-cases/notify-earlier-slot-opportunity.use-case';

const context = {
  tenantId: 'tenant-1',
  brandId: 'brand-1',
  localId: 'local-1',
  actorUserId: null,
  timezone: 'Europe/Madrid',
  correlationId: 'corr-1',
};

test('earlier-slot policy only accepts the released compatible start before the appointment', () => {
  const opportunityStart = new Date('2026-08-20T08:00:00.000Z');
  const result = findFirstEarlierSlot({
    dateOnly: '2026-08-20',
    availableSlots: ['09:30', '10:00', '10:30'],
    now: new Date('2026-08-20T07:00:00.000Z'),
    opportunityStart,
    appointmentStart: new Date('2026-08-22T08:00:00.000Z'),
    timezone: 'Europe/Madrid',
  });

  assert.equal(result?.toISOString(), opportunityStart.toISOString());
});

test('earlier-slot policy rejects slots at or after the current appointment', () => {
  const result = findFirstEarlierSlot({
    dateOnly: '2026-08-22',
    availableSlots: ['10:00'],
    now: new Date('2026-08-20T07:00:00.000Z'),
    opportunityStart: new Date('2026-08-22T08:00:00.000Z'),
    appointmentStart: new Date('2026-08-22T08:00:00.000Z'),
    timezone: 'Europe/Madrid',
  });

  assert.equal(result, null);
});

test('earlier-slot use case ignores opportunities that have already passed', async () => {
  let delegated = false;
  const useCase = new NotifyEarlierSlotOpportunityUseCase(
    {
      notifyFirstEligibleRequest: async () => {
        delegated = true;
        return true;
      },
    },
    { now: () => new Date('2026-08-20T10:00:00.000Z') },
  );

  const result = await useCase.execute({
    context,
    releasedAppointmentId: 'appointment-1',
    barberId: 'barber-1',
    releasedStartDateTime: new Date('2026-08-20T09:00:00.000Z'),
  });

  assert.equal(result, false);
  assert.equal(delegated, false);
});

test('earlier-slot use case delegates future opportunities', async () => {
  const commands: unknown[] = [];
  const useCase = new NotifyEarlierSlotOpportunityUseCase(
    {
      notifyFirstEligibleRequest: async (command) => {
        commands.push(command);
        return true;
      },
    },
    { now: () => new Date('2026-08-20T08:00:00.000Z') },
  );
  const command = {
    context,
    releasedAppointmentId: 'appointment-1',
    barberId: 'barber-1',
    releasedStartDateTime: new Date('2026-08-20T09:00:00.000Z'),
  };

  assert.equal(await useCase.execute(command), true);
  assert.deepEqual(commands, [command]);
});
