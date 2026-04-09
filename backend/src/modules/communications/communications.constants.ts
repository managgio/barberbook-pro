export const COMMUNICATION_ACTION_TYPES = ['solo_comunicar', 'comunicar_y_cancelar'] as const;
export const COMMUNICATION_SCOPE_TYPES = [
  'all_day',
  'appointments_morning',
  'appointments_afternoon',
  'day_time_range',
  'professional_single',
  'professional_multi',
  'appointment_selection',
  'all_clients',
] as const;
export const COMMUNICATION_CHANNELS = ['email', 'sms', 'whatsapp'] as const;
export const COMMUNICATION_TEMPLATE_KEYS = [
  'medical_leave',
  'local_closure',
  'delay_incident',
  'organizational_change',
  'general_announcement',
] as const;

export const COMMUNICATION_PERMISSION_KEYS = [
  'communications:view',
  'communications:create_draft',
  'communications:preview',
  'communications:execute',
  'communications:schedule',
  'communications:cancel_scheduled',
  'communications:duplicate',
  'communications:view_history',
] as const;

export type CommunicationPermissionKey = typeof COMMUNICATION_PERMISSION_KEYS[number];
