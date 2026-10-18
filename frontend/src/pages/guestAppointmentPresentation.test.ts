import { describe, expect, it } from 'vitest';

import {
  formatGuestAppointmentDateTime,
  getCancellationReasonTranslationKey,
  getGuestAppointmentStatusTone,
} from './guestAppointmentPresentation';

describe('guest appointment presentation', () => {
  it('maps appointment states to stable visual tones', () => {
    expect(getGuestAppointmentStatusTone('scheduled')).toBe('pending');
    expect(getGuestAppointmentStatusTone('completed')).toBe('success');
    expect(getGuestAppointmentStatusTone('cancelled')).toBe('danger');
    expect(getGuestAppointmentStatusTone('no_show')).toBe('muted');
  });

  it('maps cancellation reasons without leaking backend messages', () => {
    expect(getCancellationReasonTranslationKey('cancellation_cutoff_reached'))
      .toBe('guestAppointment.cancellation.reason.cancellation_cutoff_reached');
    expect(getCancellationReasonTranslationKey(null)).toBeNull();
  });

  it('formats the server timestamp in the appointment timezone', () => {
    expect(formatGuestAppointmentDateTime({
      value: '2026-10-17T10:30:00.000Z',
      locale: 'es-ES',
      timezone: 'Europe/Madrid',
    })).toContain('12:30');
  });

  it('falls back safely when the timezone is malformed', () => {
    expect(formatGuestAppointmentDateTime({
      value: '2026-10-17T10:30:00.000Z',
      locale: 'en-GB',
      timezone: 'not-a-timezone',
    })).not.toBeNull();
  });
});
