import { canSendRoutineSms } from './sms-delivery-runtime.policy';

export type NotificationCapabilities = {
  sms: boolean;
  whatsapp: boolean;
};

export const resolveNotificationCapabilities = (input: {
  notificationPrefs?: { sms?: boolean; whatsapp?: boolean } | null;
  runtimeEnvironment?: string | null;
  smsGatewayConfigured: boolean;
  whatsappGatewayConfigured: boolean;
}): NotificationCapabilities => ({
  sms:
    input.notificationPrefs?.sms === true
    && canSendRoutineSms(input.runtimeEnvironment)
    && input.smsGatewayConfigured,
  whatsapp:
    input.notificationPrefs?.whatsapp !== false
    && input.whatsappGatewayConfigured,
});
