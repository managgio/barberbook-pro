export const APPOINTMENT_REMINDER_CHANNELS = ['sms', 'whatsapp'] as const;

export type AppointmentReminderChannel = (typeof APPOINTMENT_REMINDER_CHANNELS)[number];

export const normalizeAppointmentReminderChannels = (
  channels?: readonly AppointmentReminderChannel[] | null,
): AppointmentReminderChannel[] =>
  Array.from(new Set(channels || []));
