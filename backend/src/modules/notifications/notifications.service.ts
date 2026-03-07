import { Inject, Injectable } from '@nestjs/common';
import {
  ENGAGEMENT_NOTIFICATION_MANAGEMENT_PORT,
  EngagementNotificationAppointmentAction,
  EngagementNotificationAppointmentInfo,
  EngagementNotificationContactInfo,
  EngagementNotificationManagementPort,
  EngagementTestWhatsappInput,
} from '../../contexts/engagement/ports/outbound/notification-management.port';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(ENGAGEMENT_NOTIFICATION_MANAGEMENT_PORT)
    private readonly notificationManagementPort: EngagementNotificationManagementPort,
  ) {}

  sendAppointmentEmail(
    contact: EngagementNotificationContactInfo,
    appointment: EngagementNotificationAppointmentInfo,
    action: EngagementNotificationAppointmentAction,
  ) {
    return this.notificationManagementPort.sendAppointmentEmail(contact, appointment, action);
  }

  sendReferralRewardEmail(params: {
    contact: EngagementNotificationContactInfo;
    title: string;
    message: string;
    ctaLabel?: string;
    ctaUrl?: string;
  }) {
    return this.notificationManagementPort.sendReferralRewardEmail(params);
  }

  sendReminderSms(contact: EngagementNotificationContactInfo, appointment: EngagementNotificationAppointmentInfo) {
    return this.notificationManagementPort.sendReminderSms(contact, appointment);
  }

  sendTestSms(phone: string, message?: string | null) {
    return this.notificationManagementPort.sendTestSms(phone, message);
  }

  sendReminderWhatsapp(
    contact: EngagementNotificationContactInfo,
    appointment: EngagementNotificationAppointmentInfo,
  ) {
    return this.notificationManagementPort.sendReminderWhatsapp(contact, appointment);
  }

  sendTestWhatsapp(phone: string, options?: EngagementTestWhatsappInput) {
    return this.notificationManagementPort.sendTestWhatsapp(phone, options);
  }
}
