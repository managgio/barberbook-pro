export const COMMERCE_LOYALTY_POLICY_READ_PORT = Symbol('COMMERCE_LOYALTY_POLICY_READ_PORT');

export type CommerceLoyaltyProgram = {
  id: string;
  scope: 'global' | 'service' | 'category';
  requiredVisits: number;
  maxCyclesPerClient: number | null;
  priority: number;
  createdAt: Date;
};

export interface CommerceLoyaltyPolicyReadPort {
  isLoyaltyEnabled(params: { localId: string }): Promise<boolean>;
  getUserRole(params: { userId: string }): Promise<string | null>;
  getServiceCategory(params: { localId: string; serviceId: string }): Promise<string | null>;
  listActiveProgramsForService(params: {
    localId: string;
    serviceId: string;
    categoryId: string | null;
  }): Promise<CommerceLoyaltyProgram[]>;
  countCompletedRewards(params: { localId: string; userId: string; programId: string }): Promise<number>;
  countCompletedVisits(params: { localId: string; userId: string; programId: string }): Promise<number>;
  countActiveVisits(params: { localId: string; userId: string; programId: string }): Promise<number>;
}
