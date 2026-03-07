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
  ): Promise<void>;
  sendReferralRewardEmail(params: {
    contact: EngagementNotificationContactInfo;
    title: string;
    message: string;
    ctaLabel?: string;
    ctaUrl?: string;
  }): Promise<void>;
  sendReminderSms(
    contact: EngagementNotificationContactInfo,
    appointment: EngagementNotificationAppointmentInfo,
  ): Promise<void>;
  sendTestSms(phone: string, message?: string | null): Promise<{ success: boolean; sid: string }>;
  sendReminderWhatsapp(
    contact: EngagementNotificationContactInfo,
    appointment: EngagementNotificationAppointmentInfo,
  ): Promise<void>;
  sendTestWhatsapp(phone: string, options?: EngagementTestWhatsappInput): Promise<{ success: boolean; sid: string }>;
}
