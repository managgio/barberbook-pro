import { EngagementNotificationManagementPort } from '../../ports/outbound/notification-management.port';
import { EngagementNotificationReminderPort } from '../../ports/outbound/notification-reminder.port';

export class RunNotificationRemindersUseCase {
  constructor(
    private readonly reminderPort: EngagementNotificationReminderPort,
    private readonly notificationManagementPort: EngagementNotificationManagementPort,
  ) {}

  async execute(params: { windowStart: Date; windowEnd: Date; smsEnabled: boolean; whatsappEnabled: boolean }) {
    if (!params.smsEnabled && !params.whatsappEnabled) {
      return 0;
    }

    const reminders = await this.reminderPort.findPendingReminders({
      windowStart: params.windowStart,
      windowEnd: params.windowEnd,
    });

    let sentCount = 0;
    for (const reminder of reminders) {
      if (!reminder.allowSms && !reminder.allowWhatsapp) {
        continue;
      }

      if (params.smsEnabled && reminder.allowSms) {
        await this.notificationManagementPort.sendReminderSms(reminder.contact, reminder.appointment);
      }
      if (params.whatsappEnabled && reminder.allowWhatsapp) {
        await this.notificationManagementPort.sendReminderWhatsapp(reminder.contact, reminder.appointment);
      }

      await this.reminderPort.markReminderSent(reminder.appointmentId);
      sentCount += 1;
    }
    return sentCount;
  }
}
