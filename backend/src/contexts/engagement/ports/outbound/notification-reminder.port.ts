import { EngagementNotificationAppointmentInfo, EngagementNotificationContactInfo } from './notification-management.port';

export const ENGAGEMENT_NOTIFICATION_REMINDER_PORT = Symbol('ENGAGEMENT_NOTIFICATION_REMINDER_PORT');

export type EngagementPendingReminder = {
  appointmentId: string;
  allowSms: boolean;
  allowWhatsapp: boolean;
  contact: EngagementNotificationContactInfo;
  appointment: EngagementNotificationAppointmentInfo;
};

export interface EngagementNotificationReminderPort {
  findPendingReminders(params: { windowStart: Date; windowEnd: Date }): Promise<EngagementPendingReminder[]>;
  markReminderSent(appointmentId: string): Promise<void>;
}
