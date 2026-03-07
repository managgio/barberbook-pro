import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  getAdminPermissionViolationMessage,
  getCancellationCutoffViolationMessage,
  getCompletionTimingViolationMessage,
  getInvalidStatusTransitionMessage,
} from '@/contexts/booking/domain/services/update-appointment-policy';

test('invalid status transition policy returns violations', () => {
  assert.equal(
    getInvalidStatusTransitionMessage('cancelled', 'completed'),
    'Appointment marked as no-show or cancelled cannot be completed.',
  );
  assert.equal(
    getInvalidStatusTransitionMessage('completed', 'scheduled'),
    'Completed appointment cannot be set to scheduled.',
  );
  assert.equal(getInvalidStatusTransitionMessage('scheduled', 'completed'), null);
});

test('completion timing policy blocks completion before threshold', () => {
  const message = getCompletionTimingViolationMessage({
    nextStatus: 'completed',
    now: new Date('2026-03-05T10:00:00.000Z'),
    nextStartDateTime: new Date('2026-03-05T10:00:00.000Z'),
    durationMinutes: 30,
    confirmationGraceMs: 60 * 1000,
  });
  assert.equal(message, 'Appointment cannot be completed before it ends.');
});

test('cancellation cutoff policy blocks near-time cancellation for clients', () => {
  const nowMs = new Date('2026-03-05T10:00:00.000Z').getTime();
  const nextStartDateTimeMs = new Date('2026-03-05T11:00:00.000Z').getTime();
  const message = getCancellationCutoffViolationMessage({
    isCancelled: true,
    isAdminActor: false,
    cutoffHours: 2,
    nowMs,
    nextStartDateTimeMs,
  });
  assert.equal(message, 'Solo puedes cancelar con más de 2h de antelación.');
});

test('admin permission policy returns first applicable violation', () => {
  assert.equal(
    getAdminPermissionViolationMessage({
      isAdminActor: false,
      isPriceModified: true,
      isPaymentMethodModified: false,
      hasRewardFieldsModified: false,
    }),
    'Solo un admin puede modificar el precio final.',
  );
  assert.equal(
    getAdminPermissionViolationMessage({
      isAdminActor: false,
      isPriceModified: false,
      isPaymentMethodModified: true,
      hasRewardFieldsModified: false,
    }),
    'Solo un admin puede actualizar el método de pago.',
  );
  assert.equal(
    getAdminPermissionViolationMessage({
      isAdminActor: false,
      isPriceModified: false,
      isPaymentMethodModified: false,
      hasRewardFieldsModified: true,
    }),
    'Solo un admin puede modificar recompensas.',
  );
  assert.equal(
    getAdminPermissionViolationMessage({
      isAdminActor: true,
      isPriceModified: true,
      isPaymentMethodModified: true,
      hasRewardFieldsModified: true,
    }),
    null,
  );
});
