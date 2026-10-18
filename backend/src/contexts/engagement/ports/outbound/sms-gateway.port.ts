export const ENGAGEMENT_SMS_GATEWAY_PORT = Symbol('ENGAGEMENT_SMS_GATEWAY_PORT');

export type EngagementSmsGatewayFailureCode =
  | 'SMS_ROUTINE_DELIVERY_DISABLED'
  | 'SMS_TEST_LOCAL_ONLY'
  | 'SMS_GATEWAY_NOT_CONFIGURED'
  | 'SMS_GATEWAY_CALLBACK_INVALID'
  | 'SMS_GATEWAY_AUTH_FAILED'
  | 'SMS_RECIPIENT_OPTED_OUT'
  | 'SMS_RECIPIENT_INVALID'
  | 'SMS_SENDER_INVALID'
  | 'SMS_RATE_LIMITED'
  | 'SMS_GATEWAY_TEMPORARY_FAILURE'
  | 'SMS_GATEWAY_DELIVERY_FAILED';

export type EngagementSmsGatewayResult =
  | {
      status: 'accepted';
      providerMessageId: string;
      /** Sender selected by the provider, when exposed by its response. */
      sender?: string;
      cost?: { amount: number; currency: string };
    }
  | {
      status: 'failed';
      code: EngagementSmsGatewayFailureCode;
      message: string;
      retryable: boolean;
      critical: boolean;
    };

export type EngagementSmsSendCommand = {
  to: string;
  body: string;
  /** The business purpose controls which runtime environments may send. */
  purpose: 'routine' | 'platform_test';
  /**
   * An opaque application reference that a provider adapter may append to its
   * delivery callback. It must never contain recipient data or credentials.
   */
  deliveryReference?: string;
};

export interface EngagementSmsGatewayPort {
  /**
   * Reports whether routine delivery has all provider-owned global settings.
   * The caller remains responsible for tenant preferences and environment policy.
   */
  isReadyForRoutineDelivery(): boolean;
  send(command: EngagementSmsSendCommand): Promise<EngagementSmsGatewayResult>;
}
