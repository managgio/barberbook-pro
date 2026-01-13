import { AppointmentStatus } from '@/data/types';

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: 'Programada',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_show: 'Ausencia',
};

const STATUS_BADGE_CLASSES: Record<AppointmentStatus, string> = {
  scheduled: 'bg-amber-500/10 text-amber-500',
  completed: 'bg-green-500/10 text-green-500',
  cancelled: 'bg-muted text-muted-foreground',
  no_show: 'bg-rose-500/10 text-rose-500',
};

const STATUS_DOT_CLASSES: Record<AppointmentStatus, string> = {
  scheduled: 'bg-amber-500',
  completed: 'bg-green-500',
  cancelled: 'bg-muted-foreground',
  no_show: 'bg-rose-500',
};

export const APPOINTMENT_STATUSES: AppointmentStatus[] = ['scheduled', 'completed', 'no_show', 'cancelled'];

export const getAppointmentStatusLabel = (status: AppointmentStatus) => STATUS_LABELS[status];

export const getAppointmentStatusBadgeClass = (status: AppointmentStatus) => STATUS_BADGE_CLASSES[status];

export const getAppointmentStatusDotClass = (status: AppointmentStatus) => STATUS_DOT_CLASSES[status];

export const isAppointmentActive = (status: AppointmentStatus) =>
  status !== 'cancelled' && status !== 'no_show';

export const isAppointmentUpcomingStatus = (status: AppointmentStatus) => status === 'scheduled';

export const isAppointmentRevenueStatus = (status: AppointmentStatus) =>
  status === 'completed';
