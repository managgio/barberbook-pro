export const ENGAGEMENT_WHATSAPP_GATEWAY_PORT = Symbol('ENGAGEMENT_WHATSAPP_GATEWAY_PORT');

export type EngagementWhatsappTemplateData = {
  name: string;
  brand: string;
  date: string;
  time: string;
};

export type EngagementWhatsappGatewayResult =
  | {
      status: 'accepted';
      providerMessageId: string;
      cost?: { amount: number; currency: string };
    }
  | {
      status: 'failed';
      code:
        | 'WHATSAPP_GATEWAY_NOT_CONFIGURED'
        | 'WHATSAPP_GATEWAY_AUTH_FAILED'
        | 'WHATSAPP_RECIPIENT_OPTED_OUT'
        | 'WHATSAPP_RECIPIENT_INVALID'
        | 'WHATSAPP_SENDER_INVALID'
        | 'WHATSAPP_RATE_LIMITED'
        | 'WHATSAPP_GATEWAY_TEMPORARY_FAILURE'
        | 'WHATSAPP_GATEWAY_DELIVERY_FAILED';
      message: string;
      retryable: boolean;
      critical: boolean;
    };

export type EngagementWhatsappSendCommand = {
  to: string;
  body: string;
  templateData: EngagementWhatsappTemplateData;
};

export interface EngagementWhatsappGatewayPort {
  isReadyForRoutineDelivery(): boolean;
  send(command: EngagementWhatsappSendCommand): Promise<EngagementWhatsappGatewayResult>;
}
