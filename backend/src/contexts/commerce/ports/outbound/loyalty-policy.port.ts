export const COMMERCE_LOYALTY_POLICY_PORT = Symbol('COMMERCE_LOYALTY_POLICY_PORT');

export type CommerceLoyaltyRewardDecision = {
  programId: string;
  isFreeNext: boolean;
} | null;

export interface CommerceLoyaltyPolicyPort {
  resolveRewardDecision(
    userId: string | null | undefined,
    serviceId: string,
  ): Promise<CommerceLoyaltyRewardDecision>;
}
