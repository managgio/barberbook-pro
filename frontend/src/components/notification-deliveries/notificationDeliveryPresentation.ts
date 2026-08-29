import type {
  NotificationDeliveryChannel,
  NotificationDeliveryKind,
  NotificationDeliveryStatus,
} from '@/data/api/notificationDeliveries';

export const STATUS_META: Record<NotificationDeliveryStatus, { label: string; className: string }> = {
  pending: { label: 'Pendiente', className: 'border-blue-500/40 text-blue-700 dark:text-blue-300' },
  processing: { label: 'Procesando', className: 'border-blue-500/40 text-blue-700 dark:text-blue-300' },
  accepted: { label: 'Aceptado', className: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300' },
  retrying: { label: 'Reintentando', className: 'border-amber-500/40 text-amber-700 dark:text-amber-300' },
  failed: { label: 'Fallido', className: 'border-destructive/40 text-destructive' },
  skipped: { label: 'No enviado', className: 'border-slate-500/40 text-muted-foreground' },
};

export const KIND_LABELS: Record<NotificationDeliveryKind, string> = {
  appointment_created: 'Confirmación de cita',
  appointment_updated: 'Cambio de cita',
  appointment_cancelled: 'Cancelación de cita',
  earlier_slot: 'Hueco anterior',
  reminder: 'Recordatorio',
  communication: 'Comunicado',
  referral_reward: 'Recompensa de referido',
};

export const CHANNEL_LABELS: Record<NotificationDeliveryChannel, string> = {
  email: 'Correo',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
};

export const formatDeliveryDateTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value))
    : '-';
