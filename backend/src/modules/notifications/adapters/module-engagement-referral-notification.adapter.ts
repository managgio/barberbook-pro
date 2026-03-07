import { Injectable } from '@nestjs/common';
import { EngagementReferralNotificationPort } from '../../../contexts/engagement/ports/outbound/referral-notification.port';
import { NotificationsService } from '../notifications.service';

@Injectable()
export class ModuleEngagementReferralNotificationAdapter implements EngagementReferralNotificationPort {
  constructor(private readonly notificationsService: NotificationsService) {}

  async sendRewardEmail(params: {
    name: string | null;
    email: string;
    title: string;
    message: string;
  }): Promise<void> {
    await this.notificationsService.sendReferralRewardEmail({
      contact: { name: params.name ?? '', email: params.email },
      title: params.title,
      message: params.message,
    });
  }
}
