export const ENGAGEMENT_NOTIFICATION_MANAGEMENT_PORT = Symbol('ENGAGEMENT_NOTIFICATION_MANAGEMENT_PORT');

export type EngagementNotificationContactInfo = {
  email?: string | null;
  phone?: string | null;
  name?: string | null;
};

export type EngagementNotificationAppointmentInfo = {
  date: Date;
  serviceName?: string;
  barberName?: string;
  location?: string;
};

export type EngagementNotificationAppointmentAction = 'creada' | 'actualizada' | 'cancelada';

export type EngagementNotificationDeliveryResult =
  | { status: 'accepted'; providerMessageId?: string | null }
  | { status: 'skipped'; code: string; message: string }
  | {
      status: 'failed';
      code: string;
      message: string;
      retryable: boolean;
      critical: boolean;
    };

export type EngagementTestWhatsappInput = {
  message?: string | null;
  name?: string;
  brand?: string;
  date?: string;
  time?: string;
};

export interface EngagementNotificationManagementPort {
  sendAppointmentEmail(
    contact: EngagementNotificationContactInfo,
    appointment: EngagementNotificationAppointmentInfo,
    action: EngagementNotificationAppointmentAction,
  ): Promise<EngagementNotificationDeliveryResult>;
  sendReferralRewardEmail(params: {
    contact: EngagementNotificationContactInfo;
    title: string;
    message: string;
    ctaLabel?: string;
    ctaUrl?: string;
  }): Promise<EngagementNotificationDeliveryResult>;
  sendBroadcastEmail(params: {
    contact: EngagementNotificationContactInfo;
    subject: string;
    message: string;
  }): Promise<EngagementNotificationDeliveryResult>;
  sendBroadcastSms(params: {
    contact: EngagementNotificationContactInfo;
    message: string;
  }): Promise<EngagementNotificationDeliveryResult>;
  sendBroadcastWhatsapp(params: {
    contact: EngagementNotificationContactInfo;
    message: string;
    date?: string;
    time?: string;
  }): Promise<EngagementNotificationDeliveryResult>;
  sendReminderSms(
    contact: EngagementNotificationContactInfo,
    appointment: EngagementNotificationAppointmentInfo,
  ): Promise<EngagementNotificationDeliveryResult>;
  sendTestSms(phone: string, message?: string | null): Promise<{ success: boolean; sid: string }>;
  sendReminderWhatsapp(
    contact: EngagementNotificationContactInfo,
    appointment: EngagementNotificationAppointmentInfo,
  ): Promise<EngagementNotificationDeliveryResult>;
  sendTestWhatsapp(phone: string, options?: EngagementTestWhatsappInput): Promise<{ success: boolean; sid: string }>;
}
