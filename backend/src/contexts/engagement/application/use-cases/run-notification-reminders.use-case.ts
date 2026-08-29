import { EngagementNotificationDeliveryQueuePort } from '../../ports/outbound/notification-delivery-queue.port';
import { EngagementNotificationReminderPort } from '../../ports/outbound/notification-reminder.port';

export class RunNotificationRemindersUseCase {
  constructor(
    private readonly reminderPort: EngagementNotificationReminderPort,
    private readonly deliveryQueuePort: EngagementNotificationDeliveryQueuePort,
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
        await this.deliveryQueuePort.queueReminder({
          channel: 'sms',
          appointmentId: reminder.appointmentId,
          contact: reminder.contact,
          appointment: reminder.appointment,
        });
      }
      if (params.whatsappEnabled && reminder.allowWhatsapp) {
        await this.deliveryQueuePort.queueReminder({
          channel: 'whatsapp',
          appointmentId: reminder.appointmentId,
          contact: reminder.contact,
          appointment: reminder.appointment,
        });
      }

      await this.reminderPort.markReminderSent(reminder.appointmentId);
      sentCount += 1;
    }
    return sentCount;
  }
}
