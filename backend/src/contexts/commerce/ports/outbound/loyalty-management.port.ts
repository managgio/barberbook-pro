import { LoyaltyProgress } from '../../domain/services/loyalty-progress-policy';

export const COMMERCE_LOYALTY_MANAGEMENT_PORT = Symbol('COMMERCE_LOYALTY_MANAGEMENT_PORT');

export type CommerceLoyaltyProgramInput = {
  name: string;
  description?: string;
  scope: string;
  requiredVisits: number;
  maxCyclesPerClient?: number | null;
  priority?: number;
  isActive?: boolean;
  serviceId?: string | null;
  categoryId?: string | null;
};

export type CommerceLoyaltyProgramUpdateInput = Partial<CommerceLoyaltyProgramInput>;

export type CommerceLoyaltyProgramView = {
  id: string;
  name: string;
  description: string | null;
  scope: string;
  requiredVisits: number;
  maxCyclesPerClient: number | null;
  priority: number;
  isActive: boolean;
  serviceId: string | null;
  serviceName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CommerceLoyaltyRewardHistoryItem = {
  appointmentId: string;
  serviceId: string;
  serviceName: string | null;
  startDateTime: string;
  status: string;
  price: number;
};

export type CommerceLoyaltySummary = {
  enabled: boolean;
  blockedBySubscription?: boolean;
  programs: Array<{
    program: CommerceLoyaltyProgramView;
    progress: LoyaltyProgress;
    rewards: CommerceLoyaltyRewardHistoryItem[];
  }>;
};

export type CommerceLoyaltyPreview = {
  enabled: boolean;
  blockedBySubscription?: boolean;
  program: CommerceLoyaltyProgramView | null;
  progress: LoyaltyProgress | null;
  isFreeNext: boolean;
  nextIndex: number | null;
};

export type CommerceLoyaltyRewardDecision = {
  program: Record<string, unknown>;
  progress: LoyaltyProgress;
  isFreeNext: boolean;
  nextIndex: number;
};

export interface CommerceLoyaltyManagementPort {
  findAllAdmin(): Promise<CommerceLoyaltyProgramView[]>;
  findActive(): Promise<CommerceLoyaltyProgramView[]>;
  create(data: CommerceLoyaltyProgramInput): Promise<CommerceLoyaltyProgramView>;
  update(id: string, data: CommerceLoyaltyProgramUpdateInput): Promise<CommerceLoyaltyProgramView>;
  remove(id: string): Promise<{ success: boolean }>;
  getSummary(userId: string): Promise<CommerceLoyaltySummary>;
  getPreview(userId: string, serviceId: string): Promise<CommerceLoyaltyPreview>;
  resolveRewardDecision(
    userId: string | null | undefined,
    serviceId: string,
  ): Promise<CommerceLoyaltyRewardDecision | null>;
}
