import { EngagementAntiFraudConfig } from '../../domain/services/referral-contact';

export const ENGAGEMENT_REFERRAL_ATTRIBUTION_PERSISTENCE_PORT = Symbol('ENGAGEMENT_REFERRAL_ATTRIBUTION_PERSISTENCE_PORT');

export type EngagementReferralAttributionRecord = {
  id: string;
  status: string;
  expiresAt: Date;
  firstAppointmentId: string | null;
  referrerUserId: string;
  referredUserId: string | null;
  referredEmail: string | null;
  referredPhone: string | null;
  metadata?: unknown;
};

export type EngagementReferralAppointmentRecord = {
  id: string;
  status: string;
  referralAttributionId: string | null;
  userId: string | null;
  serviceId: string;
  guestContact: string | null;
  startDateTime: Date;
};

export type EngagementUserNotificationRecord = {
  id: string;
  name: string;
  email: string | null;
  notificationEmail: boolean | null;
};

export type EngagementActiveReferralConfig = {
  antiFraud: EngagementAntiFraudConfig;
  newCustomerOnly: boolean;
  allowedServiceIds: string[] | null;
  monthlyMaxRewardsPerReferrer: number | null;
  rewardReferrerType: string;
  rewardReferrerValue: number | null;
  rewardReferrerServiceId: string | null;
  rewardReferrerServiceName: string | null;
  rewardReferredType: string;
  rewardReferredValue: number | null;
  rewardReferredServiceId: string | null;
  rewardReferredServiceName: string | null;
};

export interface EngagementReferralAttributionPersistencePort {
  findAttributionById(params: {
    localId: string;
    attributionId: string;
    tx?: unknown;
  }): Promise<EngagementReferralAttributionRecord | null>;
  findLatestPendingAttributionByUser(params: {
    localId: string;
    userId: string;
    now: Date;
  }): Promise<EngagementReferralAttributionRecord | null>;
  findLatestPendingAttributionByContact(params: {
    localId: string;
    email: string | null;
    phone: string | null;
    now: Date;
  }): Promise<EngagementReferralAttributionRecord | null>;
  getActiveReferralConfig(): Promise<EngagementActiveReferralConfig | null>;
  getUserContact(params: { userId: string; tx?: unknown }): Promise<{ email: string | null; phone: string | null } | null>;
  markAttributionBooked(params: {
    attributionId: string;
    appointmentId: string;
    referredUserId: string | null;
    referredEmail: string | null;
    referredPhone: string | null;
    tx?: unknown;
  }): Promise<void>;
  findAttributionByFirstAppointment(params: {
    localId: string;
    appointmentId: string;
  }): Promise<EngagementReferralAttributionRecord | null>;
  updateAttributionStatus(params: {
    attributionId: string;
    status: string;
    firstAppointmentId?: string | null;
    metadataReason?: string | null;
    tx?: unknown;
  }): Promise<void>;
  findAppointmentForReferralCompletion(params: {
    localId: string;
    appointmentId: string;
  }): Promise<EngagementReferralAppointmentRecord | null>;
  findPreviousCompletedCustomerAppointment(params: {
    localId: string;
    beforeDate: Date;
    userId: string | null;
    email: string | null;
    phone: string | null;
  }): Promise<boolean>;
  countRewardedAttributionsByReferrer(params: {
    localId: string;
    referrerUserId: string;
    from: Date;
    to: Date;
  }): Promise<number>;
  runInTransaction<T>(work: (tx: unknown) => Promise<T>): Promise<T>;
  findUsersByIds(params: { ids: string[] }): Promise<EngagementUserNotificationRecord[]>;
}
