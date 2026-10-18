import { describe, expect, it } from 'vitest';
import { isValidIanaTimeZone } from '@/lib/locationTimezone';

describe('isValidIanaTimeZone', () => {
  it('accepts supported IANA zones', () => {
    expect(isValidIanaTimeZone('Europe/Madrid')).toBe(true);
    expect(isValidIanaTimeZone('Atlantic/Canary')).toBe(true);
  });

  it('rejects malformed or empty zones', () => {
    expect(isValidIanaTimeZone('Madrid')).toBe(false);
    expect(isValidIanaTimeZone('')).toBe(false);
  });
});
