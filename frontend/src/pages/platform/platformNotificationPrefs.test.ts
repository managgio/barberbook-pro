import { describe, expect, it } from 'vitest';
import { resolveEffectivePlatformNotificationPrefs } from './platformNotificationPrefs';

describe('resolveEffectivePlatformNotificationPrefs', () => {
  it('inherits omitted local channels from the brand while applying a partial override', () => {
    expect(resolveEffectivePlatformNotificationPrefs(
      { notificationPrefs: { email: false, whatsapp: false, sms: true } },
      { notificationPrefs: { email: true } },
    )).toEqual({
      email: true,
      whatsapp: false,
      sms: true,
    });
  });

  it('lets explicit local values override the corresponding brand channel only', () => {
    expect(resolveEffectivePlatformNotificationPrefs(
      { notificationPrefs: { email: true, whatsapp: true, sms: true } },
      { notificationPrefs: { whatsapp: false, sms: false } },
    )).toEqual({
      email: true,
      whatsapp: false,
      sms: false,
    });
  });

  it('uses product defaults when neither scope defines a channel', () => {
    expect(resolveEffectivePlatformNotificationPrefs({}, {})).toEqual({
      email: true,
      whatsapp: true,
      sms: false,
    });
  });
});
