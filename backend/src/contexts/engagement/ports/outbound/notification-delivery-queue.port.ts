import {
  EngagementNotificationAppointmentInfo,
  EngagementNotificationContactInfo,
} from './notification-management.port';

export const ENGAGEMENT_NOTIFICATION_DELIVERY_QUEUE_PORT = Symbol('ENGAGEMENT_NOTIFICATION_DELIVERY_QUEUE_PORT');

export interface EngagementNotificationDeliveryQueuePort {
  queueReminder(params: {
    channel: 'sms' | 'whatsapp';
    appointmentId: string;
    contact: EngagementNotificationContactInfo;
    appointment: EngagementNotificationAppointmentInfo;
  }): Promise<void>;
}
