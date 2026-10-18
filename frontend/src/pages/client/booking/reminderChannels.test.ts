import { describe, expect, it } from 'vitest';

import {
  isValidReminderPhone,
  normalizeReminderChannels,
  resolveAvailableReminderChannels,
  toggleReminderChannel,
} from './reminderChannels';

describe('reminder channel policy', () => {
  it('offers only channels enabled by the effective tenant configuration', () => {
    expect(resolveAvailableReminderChannels({ sms: true, whatsapp: false })).toEqual(['sms']);
    expect(resolveAvailableReminderChannels({ sms: false, whatsapp: true })).toEqual(['whatsapp']);
    expect(resolveAvailableReminderChannels({ sms: false, whatsapp: false })).toEqual([]);
  });

  it('fails closed while effective capabilities are unavailable', () => {
    expect(resolveAvailableReminderChannels(undefined)).toEqual([]);
    expect(resolveAvailableReminderChannels({})).toEqual([]);
  });

  it('drops stale or duplicated selections when availability changes', () => {
    expect(normalizeReminderChannels(['whatsapp', 'sms', 'sms'], ['sms'])).toEqual(['sms']);
  });

  it('toggles channels without duplicates and preserves canonical order', () => {
    expect(toggleReminderChannel(['whatsapp'], 'sms', true)).toEqual(['sms', 'whatsapp']);
    expect(toggleReminderChannel(['sms', 'whatsapp'], 'sms', false)).toEqual(['whatsapp']);
  });

  it('validates the phone formats accepted by guest reminder booking', () => {
    expect(isValidReminderPhone('+34 600 000 000')).toBe(true);
    expect(isValidReminderPhone('0034 600 000 000')).toBe(true);
    expect(isValidReminderPhone('600 000 000')).toBe(true);
    expect(isValidReminderPhone('123')).toBe(false);
    expect(isValidReminderPhone('+1')).toBe(false);
    expect(isValidReminderPhone('+00000000')).toBe(false);
    expect(isValidReminderPhone('0000000000')).toBe(false);
  });
});
