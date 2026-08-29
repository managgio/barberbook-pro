import { NotificationDeliveryChannel } from '@prisma/client';
import {
  EngagementNotificationAppointmentAction,
  EngagementNotificationAppointmentInfo,
  EngagementNotificationContactInfo,
} from '../../contexts/engagement/ports/outbound/notification-management.port';

export type AppointmentEmailPayload = {
  template: 'appointment_email';
  contact: EngagementNotificationContactInfo;
  appointment: Omit<EngagementNotificationAppointmentInfo, 'date'> & { date: string };
  action: EngagementNotificationAppointmentAction;
};

export type BroadcastNotificationPayload = {
  template: 'broadcast';
  channel: NotificationDeliveryChannel;
  contact: EngagementNotificationContactInfo;
  title?: string;
  message: string;
  date?: string;
  time?: string;
};

export type ReminderNotificationPayload = {
  template: 'reminder';
  channel: Exclude<NotificationDeliveryChannel, 'email'>;
  contact: EngagementNotificationContactInfo;
  appointment: Omit<EngagementNotificationAppointmentInfo, 'date'> & { date: string };
};

export type ReferralRewardEmailPayload = {
  template: 'referral_email';
  contact: EngagementNotificationContactInfo;
  title: string;
  message: string;
  ctaLabel?: string;
  ctaUrl?: string;
};

export type NotificationDeliveryPayload =
  | AppointmentEmailPayload
  | BroadcastNotificationPayload
  | ReminderNotificationPayload
  | ReferralRewardEmailPayload;

export type NotificationDeliveryEnqueueOptions = {
  idempotencyKey?: string;
  appointmentId?: string | null;
  correlationId?: string | null;
  kind?: 'earlier_slot' | 'communication';
};

export type NotificationDeliveryListFilters = {
  page?: number;
  pageSize?: number;
  status?: string;
  kind?: string;
  channel?: string;
  brandId?: string;
  localId?: string;
  includeResolved?: boolean;
};
