import { RewardType } from '@prisma/client';

export const ENGAGEMENT_REFERRAL_CONFIG_MANAGEMENT_PORT = Symbol('ENGAGEMENT_REFERRAL_CONFIG_MANAGEMENT_PORT');

export type EngagementReferralConfigPayload = {
  id: string | null;
  localId: string;
  enabled: boolean;
  attributionExpiryDays: number;
  newCustomerOnly: boolean;
  monthlyMaxRewardsPerReferrer: number | null;
  allowedServiceIds: string[] | null;
  rewardReferrerType: RewardType;
  rewardReferrerValue: number | null;
  rewardReferrerServiceId: string | null;
  rewardReferrerServiceName: string | null;
  rewardReferredType: RewardType;
  rewardReferredValue: number | null;
  rewardReferredServiceId: string | null;
  rewardReferredServiceName: string | null;
  antiFraud: {
    blockSelfByUser: boolean;
    blockSelfByContact: boolean;
    blockDuplicateContact: boolean;
  };
  appliedTemplateId: string | null;
};

export type EngagementUpdateReferralConfigInput = {
  enabled?: boolean;
  attributionExpiryDays?: number;
  newCustomerOnly?: boolean;
  monthlyMaxRewardsPerReferrer?: number | null;
  allowedServiceIds?: string[] | null;
  rewardReferrerType?: RewardType;
  rewardReferrerValue?: number | null;
  rewardReferrerServiceId?: string | null;
  rewardReferredType?: RewardType;
  rewardReferredValue?: number | null;
  rewardReferredServiceId?: string | null;
  antiFraud?: {
    blockSelfByUser?: boolean;
    blockSelfByContact?: boolean;
    blockDuplicateContact?: boolean;
  };
};

export interface EngagementReferralConfigManagementPort {
  isModuleEnabled(): Promise<boolean>;
  getConfig(): Promise<EngagementReferralConfigPayload>;
  getConfigOrThrow(): Promise<EngagementReferralConfigPayload>;
  updateConfig(data: EngagementUpdateReferralConfigInput): Promise<EngagementReferralConfigPayload>;
  applyTemplate(templateId: string): Promise<EngagementReferralConfigPayload>;
  copyFromLocation(sourceLocationId: string): Promise<EngagementReferralConfigPayload>;
}
