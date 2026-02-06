import {
  CreateLoyaltyProgramPayload,
  LoyaltyPreview,
  LoyaltyProgram,
  LoyaltySummary,
} from '@/data/types';

import { apiRequest } from './request';

export const getLoyaltyPrograms = async (): Promise<LoyaltyProgram[]> =>
  apiRequest('/loyalty/programs');

export const getActiveLoyaltyPrograms = async (): Promise<LoyaltyProgram[]> =>
  apiRequest('/loyalty/programs/active');

export const createLoyaltyProgram = async (data: CreateLoyaltyProgramPayload): Promise<LoyaltyProgram> =>
  apiRequest('/loyalty/programs', { method: 'POST', body: data });

export const updateLoyaltyProgram = async (
  id: string,
  data: Partial<CreateLoyaltyProgramPayload>,
): Promise<LoyaltyProgram> =>
  apiRequest(`/loyalty/programs/${id}`, { method: 'PATCH', body: data });

export const deleteLoyaltyProgram = async (id: string): Promise<void> =>
  apiRequest(`/loyalty/programs/${id}`, { method: 'DELETE' });

export const getLoyaltySummary = async (userId: string): Promise<LoyaltySummary> =>
  apiRequest('/loyalty/summary', { query: { userId } });

export const getLoyaltyPreview = async (userId: string, serviceId: string): Promise<LoyaltyPreview> =>
  apiRequest('/loyalty/preview', { query: { userId, serviceId } });
