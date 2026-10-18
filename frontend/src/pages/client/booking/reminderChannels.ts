export const REMINDER_CHANNELS = ['sms', 'whatsapp'] as const;

export type ReminderChannel = typeof REMINDER_CHANNELS[number];

type NotificationChannelConfig = {
  sms?: boolean;
  whatsapp?: boolean;
} | null | undefined;

export const resolveAvailableReminderChannels = (
  notificationConfig: NotificationChannelConfig,
): ReminderChannel[] => REMINDER_CHANNELS.filter(
  (channel) => notificationConfig?.[channel] === true,
);

export const normalizeReminderChannels = (
  selectedChannels: readonly ReminderChannel[],
  availableChannels: readonly ReminderChannel[],
): ReminderChannel[] => {
  const selected = new Set(selectedChannels);
  return REMINDER_CHANNELS.filter(
    (channel) => selected.has(channel) && availableChannels.includes(channel),
  );
};

export const toggleReminderChannel = (
  selectedChannels: readonly ReminderChannel[],
  channel: ReminderChannel,
  checked: boolean,
): ReminderChannel[] => normalizeReminderChannels(
  checked
    ? [...selectedChannels, channel]
    : selectedChannels.filter((selectedChannel) => selectedChannel !== channel),
  REMINDER_CHANNELS,
);

export const isValidReminderPhone = (value: string) => {
  const raw = value.trim();
  if (!raw) return false;
  const digits = raw.replace(/\D/g, '');
  if (raw.startsWith('+')) return /^[1-9]\d{7,14}$/.test(digits);
  if (digits.startsWith('00')) {
    const internationalDigits = digits.slice(2);
    return /^[1-9]\d{7,14}$/.test(internationalDigits);
  }
  if (digits.startsWith('34')) return /^[1-9]\d{7,14}$/.test(digits);
  return digits.length === 9 || (digits.length === 10 && digits.startsWith('0'));
};
