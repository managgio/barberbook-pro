type NotificationPreferences = {
  email?: boolean;
  sms?: boolean;
  whatsapp?: boolean;
} | null | undefined;

type NotificationCapabilities = {
  sms?: boolean;
  whatsapp?: boolean;
} | null | undefined;

export const resolveProfileNotificationAvailability = (params: {
  preferences: NotificationPreferences;
  capabilities: NotificationCapabilities;
}) => ({
  email: params.preferences?.email !== false,
  sms: params.capabilities?.sms === true,
  whatsapp: params.capabilities?.whatsapp === true,
});

export const normalizeProfileNotificationPreferences = (params: {
  preferences: { email: boolean; sms: boolean; whatsapp: boolean };
  availability: { email: boolean; sms: boolean; whatsapp: boolean };
  persistedPreferences: NotificationPreferences;
}) => ({
  email: params.availability.email ? params.preferences.email : false,
  sms: params.availability.sms
    ? params.preferences.sms
    : (params.persistedPreferences?.sms ?? true),
  whatsapp: params.availability.whatsapp
    ? params.preferences.whatsapp
    : (params.persistedPreferences?.whatsapp ?? true),
});
