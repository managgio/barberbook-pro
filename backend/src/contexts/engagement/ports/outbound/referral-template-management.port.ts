import { RewardType } from '@prisma/client';

export const ENGAGEMENT_REFERRAL_TEMPLATE_MANAGEMENT_PORT = Symbol(
  'ENGAGEMENT_REFERRAL_TEMPLATE_MANAGEMENT_PORT',
);

export type EngagementReferralAntiFraudPayload = {
  blockSelfByUser: boolean;
  blockSelfByContact: boolean;
  blockDuplicateContact: boolean;
};

export type EngagementReferralTemplatePayload = {
  id: string;
  brandId: string;
  name: string;
  enabled: boolean;
  attributionExpiryDays: number;
  newCustomerOnly: boolean;
  monthlyMaxRewardsPerReferrer: number | null;
  allowedServiceIds: string[] | null;
  rewardReferrerType: RewardType;
  rewardReferrerValue: number | null;
  rewardReferrerServiceId: string | null;
  rewardReferredType: RewardType;
  rewardReferredValue: number | null;
  rewardReferredServiceId: string | null;
  antiFraud: EngagementReferralAntiFraudPayload;
  createdAt: Date;
  updatedAt: Date;
};

export type EngagementCreateReferralTemplateInput = {
  name: string;
  enabled?: boolean;
  attributionExpiryDays?: number;
  newCustomerOnly?: boolean;
  monthlyMaxRewardsPerReferrer?: number | null;
  allowedServiceIds?: string[] | null;
  rewardReferrerType: RewardType;
  rewardReferrerValue?: number | null;
  rewardReferrerServiceId?: string | null;
  rewardReferredType: RewardType;
  rewardReferredValue?: number | null;
  rewardReferredServiceId?: string | null;
  antiFraud?: Partial<EngagementReferralAntiFraudPayload>;
};

export type EngagementUpdateReferralTemplateInput = Partial<
  Omit<EngagementCreateReferralTemplateInput, 'name'>
> & {
  name?: string;
};

export interface EngagementReferralTemplateManagementPort {
  list(brandId: string): Promise<EngagementReferralTemplatePayload[]>;
  listForLocal(localId: string): Promise<EngagementReferralTemplatePayload[]>;
  create(
    brandId: string,
    data: EngagementCreateReferralTemplateInput,
  ): Promise<EngagementReferralTemplatePayload>;
  update(id: string, data: EngagementUpdateReferralTemplateInput): Promise<EngagementReferralTemplatePayload>;
  remove(id: string): Promise<{ success: boolean }>;
}
