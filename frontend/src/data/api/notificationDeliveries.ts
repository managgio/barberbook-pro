import { apiRequest } from './request';

export type NotificationDeliveryChannel = 'email' | 'sms' | 'whatsapp';

export type NotificationDeliveryStatus =
  | 'pending'
  | 'processing'
  | 'accepted'
  | 'retrying'
  | 'failed'
  | 'skipped';

export type NotificationDeliveryKind =
  | 'appointment_created'
  | 'appointment_updated'
  | 'appointment_cancelled'
  | 'earlier_slot'
  | 'reminder'
  | 'communication'
  | 'referral_reward';

export type NotificationDeliveryAttempt = {
  id: string;
  attemptNumber: number;
  status: 'accepted' | 'failed' | 'skipped';
  providerMessageId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  occurredAt: string;
};

export type NotificationDeliveryItem = {
  id: string;
  brandId: string;
  brandName: string;
  localId: string;
  localName: string;
  appointmentId: string | null;
  channel: NotificationDeliveryChannel;
  kind: NotificationDeliveryKind;
  status: NotificationDeliveryStatus;
  recipient: string | null;
  recipientName: string | null;
  title: string;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: string | null;
  providerMessageId: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  acceptedAt: string | null;
  failedAt: string | null;
  skippedAt: string | null;
  createdAt: string;
  attempts: NotificationDeliveryAttempt[];
};

export type NotificationDeliveryHistory = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  enabledChannels: NotificationDeliveryChannel[];
  counts: Record<NotificationDeliveryStatus, number>;
  items: NotificationDeliveryItem[];
};

export type NotificationDeliveryFilters = {
  page?: number;
  pageSize?: number;
  status?: NotificationDeliveryStatus;
  kind?: NotificationDeliveryKind;
  channel?: NotificationDeliveryChannel;
  brandId?: string;
  localId?: string;
};

export type NotificationDeliveryTenantOption = {
  id: string;
  name: string;
  locations: Array<{ id: string; name: string }>;
};

export const getTenantNotificationDeliveries = (filters: NotificationDeliveryFilters = {}) =>
  apiRequest<NotificationDeliveryHistory>('/notifications/deliveries', { query: filters });

export const retryTenantNotificationDelivery = (deliveryId: string) =>
  apiRequest<{ success: boolean }>(`/notifications/deliveries/${deliveryId}/retry`, {
    method: 'POST',
  });

export const getPlatformNotificationDeliveries = (filters: NotificationDeliveryFilters = {}) =>
  apiRequest<NotificationDeliveryHistory>('/platform/observability/deliveries', { query: filters });

export const getPlatformNotificationDeliveryFilters = () =>
  apiRequest<NotificationDeliveryTenantOption[]>('/platform/observability/delivery-filters');
