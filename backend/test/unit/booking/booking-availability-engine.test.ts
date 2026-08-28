import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  computeAvailableSlotsForBarber,
  isDateBlockedByHolidayRanges,
} from '@/contexts/booking/domain/services/availability-engine';
import { BookingSchedulePolicy } from '@/contexts/booking/domain/value-objects/schedule';

const createSchedule = (): BookingSchedulePolicy => ({
  bufferMinutes: 0,
  endOverflowMinutes: 0,
  endOverflowByDay: {},
  endOverflowByDate: {},
  breaks: {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  },
  breaksByDate: {},
  monday: {
    closed: false,
    morning: { enabled: true, start: '09:00', end: '12:00' },
    afternoon: { enabled: false, start: '00:00', end: '00:00' },
  },
  tuesday: {
    closed: false,
    morning: { enabled: true, start: '09:00', end: '12:00' },
    afternoon: { enabled: false, start: '00:00', end: '00:00' },
  },
  wednesday: {
    closed: false,
    morning: { enabled: true, start: '09:00', end: '12:00' },
    afternoon: { enabled: false, start: '00:00', end: '00:00' },
  },
  thursday: {
    closed: false,
    morning: { enabled: true, start: '09:00', end: '12:00' },
    afternoon: { enabled: false, start: '00:00', end: '00:00' },
  },
  friday: {
    closed: false,
    morning: { enabled: true, start: '09:00', end: '12:00' },
    afternoon: { enabled: false, start: '00:00', end: '00:00' },
  },
  saturday: {
    closed: true,
    morning: { enabled: false, start: '00:00', end: '00:00' },
    afternoon: { enabled: false, start: '00:00', end: '00:00' },
  },
  sunday: {
    closed: true,
    morning: { enabled: false, start: '00:00', end: '00:00' },
    afternoon: { enabled: false, start: '00:00', end: '00:00' },
  },
});

test('blocks overlapping slots for existing appointment', () => {
  const schedule = createSchedule();
  const slots = computeAvailableSlotsForBarber({
    dateOnly: '2026-03-04',
    timezone: 'Europe/Madrid',
    barberSchedule: schedule,
    shopSchedule: schedule,
    appointments: [
      {
        startDateTime: new Date('2026-03-04T08:30:00.000Z'), // 09:30 Europe/Madrid
        durationMinutes: 30,
      },
    ],
    targetDurationMinutes: 30,
  });

  assert.equal(slots.includes('09:15'), false);
  assert.equal(slots.includes('09:30'), false);
  assert.equal(slots.includes('10:00'), true);
});

test('respects buffer between appointments', () => {
  const schedule = createSchedule();
  schedule.bufferMinutes = 15;

  const slots = computeAvailableSlotsForBarber({
    dateOnly: '2026-03-04',
    timezone: 'Europe/Madrid',
    barberSchedule: schedule,
    shopSchedule: schedule,
    appointments: [
      {
        startDateTime: new Date('2026-03-04T08:30:00.000Z'), // 09:30
        durationMinutes: 30,
      },
    ],
    targetDurationMinutes: 30,
  });

  assert.equal(slots.includes('10:00'), false);
  assert.equal(slots.includes('10:15'), true);
});

test('applies end overflow by date', () => {
  const schedule = createSchedule();
  schedule.endOverflowByDate = { '2026-03-04': 30 };

  const slots = computeAvailableSlotsForBarber({
    dateOnly: '2026-03-04',
    timezone: 'Europe/Madrid',
    barberSchedule: schedule,
    shopSchedule: schedule,
    appointments: [],
    targetDurationMinutes: 30,
  });

  assert.equal(slots.includes('11:45'), true);
});

test('removes slots that overlap breaks by day and date', () => {
  const schedule = createSchedule();
  schedule.breaks!.wednesday = [{ start: '10:00', end: '10:30' }];
  schedule.breaksByDate = {
    '2026-03-04': [{ start: '11:00', end: '11:30' }],
  };

  const slots = computeAvailableSlotsForBarber({
    dateOnly: '2026-03-04',
    timezone: 'Europe/Madrid',
    barberSchedule: schedule,
    shopSchedule: schedule,
    appointments: [],
    targetDurationMinutes: 30,
  });

  assert.equal(slots.includes('10:00'), false);
  assert.equal(slots.includes('11:00'), false);
});

test('removes every slot that overlaps a persisted booking closure', () => {
  const schedule = createSchedule();
  const slots = computeAvailableSlotsForBarber({
    dateOnly: '2026-03-04',
    timezone: 'Europe/Madrid',
    barberSchedule: schedule,
    shopSchedule: schedule,
    appointments: [],
    closures: [{
      startDateTime: new Date('2026-03-04T09:00:00.000Z'), // 10:00 Europe/Madrid
      endDateTime: new Date('2026-03-04T10:00:00.000Z'), // 11:00 Europe/Madrid
    }],
    targetDurationMinutes: 30,
  });

  assert.equal(slots.includes('09:45'), false);
  assert.equal(slots.includes('10:00'), false);
  assert.equal(slots.includes('10:30'), false);
  assert.equal(slots.includes('11:00'), true);
});

test('detects blocked dates by holiday ranges', () => {
  const blocked = isDateBlockedByHolidayRanges('2026-03-04', [
    { start: '2026-03-01', end: '2026-03-03' },
    { start: '2026-03-04', end: '2026-03-04' },
  ]);

  const allowed = isDateBlockedByHolidayRanges('2026-03-05', [
    { start: '2026-03-01', end: '2026-03-04' },
  ]);

  assert.equal(blocked, true);
  assert.equal(allowed, false);
});
