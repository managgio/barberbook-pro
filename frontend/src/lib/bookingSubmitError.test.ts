import { describe, expect, it } from 'vitest';

import { classifyBookingSubmitError } from '@/lib/bookingSubmitError';

describe('classifyBookingSubmitError', () => {
  it('classifies an unavailable slot as an expected conflict', () => {
    expect(classifyBookingSubmitError('Horario no disponible')).toBe('slot_conflict');
  });

  it('classifies a staff mismatch as an expected conflict', () => {
    expect(classifyBookingSubmitError('El profesional no está disponible para este servicio')).toBe('staff_mismatch');
  });

  it('keeps unknown failures as unexpected', () => {
    expect(classifyBookingSubmitError('Database unavailable')).toBe('unexpected');
  });
});
