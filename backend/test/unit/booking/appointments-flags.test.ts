import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  getBookingAvailabilityBatchMode,
  getBookingAvailabilitySingleMode,
  getBookingCreateMode,
  getBookingRemoveMode,
  getBookingUpdateMode,
  getBookingWeeklyLoadMode,
} from '@/modules/appointments/appointments.flags';

const envKeys = [
  'BOOKING_AVAILABILITY_READ_MODE',
  'BOOKING_CAP_AVAILABILITY_SINGLE_MODE',
  'BOOKING_CAP_AVAILABILITY_BATCH_MODE',
  'BOOKING_CAP_WEEKLY_LOAD_MODE',
  'BOOKING_CAP_APPOINTMENT_CREATE_MODE',
  'BOOKING_CAP_APPOINTMENT_UPDATE_MODE',
  'BOOKING_CAP_APPOINTMENT_REMOVE_MODE',
  'BOOKING_APPOINTMENT_WRITE_MODE',
  'NODE_ENV',
  'APP_ENV',
] as const;

const snapshotEnv = () => {
  const snapshot: Record<string, string | undefined> = {};
  envKeys.forEach((key) => {
    snapshot[key] = process.env[key];
  });
  return snapshot;
};

const restoreEnv = (snapshot: Record<string, string | undefined>) => {
  envKeys.forEach((key) => {
    const value = snapshot[key];
    if (value === undefined) {
      delete process.env[key];
      return;
    }
    process.env[key] = value;
  });
};

test('booking execution policy is fixed to v2', () => {
  const snapshot = snapshotEnv();
  envKeys.forEach((key) => delete process.env[key]);

  assert.equal(getBookingAvailabilitySingleMode(), 'v2');
  assert.equal(getBookingAvailabilityBatchMode(), 'v2');
  assert.equal(getBookingWeeklyLoadMode(), 'v2');
  assert.equal(getBookingCreateMode(), 'v2');
  assert.equal(getBookingUpdateMode(), 'v2');
  assert.equal(getBookingRemoveMode(), 'v2');

  restoreEnv(snapshot);
});

test('legacy/shadow env values no longer override final mode', () => {
  const snapshot = snapshotEnv();
  envKeys.forEach((key) => delete process.env[key]);

  process.env.BOOKING_AVAILABILITY_READ_MODE = 'legacy';
  process.env.BOOKING_CAP_AVAILABILITY_SINGLE_MODE = 'shadow';
  process.env.BOOKING_CAP_AVAILABILITY_BATCH_MODE = 'legacy';
  process.env.BOOKING_CAP_WEEKLY_LOAD_MODE = 'shadow';
  process.env.BOOKING_APPOINTMENT_WRITE_MODE = 'legacy';
  process.env.BOOKING_CAP_APPOINTMENT_CREATE_MODE = 'shadow';
  process.env.BOOKING_CAP_APPOINTMENT_UPDATE_MODE = 'legacy';
  process.env.BOOKING_CAP_APPOINTMENT_REMOVE_MODE = 'shadow';

  assert.equal(getBookingAvailabilitySingleMode(), 'v2');
  assert.equal(getBookingAvailabilityBatchMode(), 'v2');
  assert.equal(getBookingWeeklyLoadMode(), 'v2');
  assert.equal(getBookingCreateMode(), 'v2');
  assert.equal(getBookingUpdateMode(), 'v2');
  assert.equal(getBookingRemoveMode(), 'v2');

  restoreEnv(snapshot);
});
