import { describe, expect, it } from 'vitest';

import {
  normalizeProfileNotificationPreferences,
  resolveProfileNotificationAvailability,
} from './profileNotificationChannels';

describe('profile notification channel availability', () => {
  it('fails closed for runtime channels when capabilities are absent', () => {
    expect(resolveProfileNotificationAvailability({
      preferences: { email: true, sms: true, whatsapp: true },
      capabilities: undefined,
    })).toEqual({ email: true, sms: false, whatsapp: false });
  });

  it('uses capabilities for SMS and WhatsApp while email remains tenant preference based', () => {
    expect(resolveProfileNotificationAvailability({
      preferences: { email: false, sms: false, whatsapp: false },
      capabilities: { sms: true, whatsapp: false },
    })).toEqual({ email: false, sms: true, whatsapp: false });
  });

  it('preserves latent consent for temporarily unavailable runtime channels', () => {
    expect(normalizeProfileNotificationPreferences({
      preferences: { email: true, sms: false, whatsapp: false },
      availability: { email: true, sms: false, whatsapp: false },
      persistedPreferences: { email: true, sms: true, whatsapp: true },
    })).toEqual({ email: true, sms: true, whatsapp: true });
  });

  it('still persists a change made while a runtime channel is available', () => {
    expect(normalizeProfileNotificationPreferences({
      preferences: { email: true, sms: false, whatsapp: true },
      availability: { email: true, sms: true, whatsapp: false },
      persistedPreferences: { email: true, sms: true, whatsapp: false },
    })).toEqual({ email: true, sms: false, whatsapp: false });
  });
});
