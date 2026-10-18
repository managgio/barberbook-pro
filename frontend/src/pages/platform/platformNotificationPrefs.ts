export type PlatformNotificationPrefs = {
  email?: boolean;
  whatsapp?: boolean;
  sms?: boolean;
};

type PlatformNotificationConfig = {
  notificationPrefs?: PlatformNotificationPrefs;
};

export type EffectivePlatformNotificationPrefs = {
  email: boolean;
  whatsapp: boolean;
  sms: boolean;
};

/** Mirrors the backend nested merge: a local preference only replaces the
 * corresponding brand value, while omitted values continue to inherit it. */
export const resolveEffectivePlatformNotificationPrefs = (
  brandConfig?: PlatformNotificationConfig | null,
  locationConfig?: PlatformNotificationConfig | null,
): EffectivePlatformNotificationPrefs => {
  const merged: PlatformNotificationPrefs = {
    ...(brandConfig?.notificationPrefs || {}),
  };

  Object.entries(locationConfig?.notificationPrefs || {}).forEach(([key, value]) => {
    if (value !== undefined) {
      merged[key as keyof PlatformNotificationPrefs] = value;
    }
  });

  return {
    email: merged.email !== false,
    whatsapp: merged.whatsapp !== false,
    sms: merged.sms === true,
  };
};
