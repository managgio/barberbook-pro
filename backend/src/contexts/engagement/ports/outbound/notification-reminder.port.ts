import { EngagementNotificationAppointmentInfo, EngagementNotificationContactInfo } from './notification-management.port';

export const ENGAGEMENT_NOTIFICATION_REMINDER_PORT = Symbol('ENGAGEMENT_NOTIFICATION_REMINDER_PORT');

export type EngagementPendingReminder = {
  appointmentId: string;
  /**
   * Stable version of the appointment snapshot used to build this reminder.
   * It changes whenever the appointment is edited, so a rescheduled appointment
   * can enqueue a new delivery without making duplicate scheduler runs non-idempotent.
   */
  reminderRevision: string;
  allowSms: boolean;
  allowWhatsapp: boolean;
  contact: EngagementNotificationContactInfo;
  appointment: EngagementNotificationAppointmentInfo;
};

export interface EngagementNotificationReminderPort {
  findPendingReminders(params: { windowStart: Date; windowEnd: Date }): Promise<EngagementPendingReminder[]>;
  markReminderSent(appointmentId: string): Promise<void>;
}
