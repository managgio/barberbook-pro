import {
  ReferralAttributionItem,
  ReferralCodeResolution,
  ReferralCodeResponse,
  ReferralConfigTemplate,
  ReferralProgramConfig,
  ReferralSummaryResponse,
  RewardWalletSummary,
} from '@/data/types';

import { apiRequest } from './request';

export const getReferralSummary = async (userId: string): Promise<ReferralSummaryResponse> =>
  apiRequest('/referrals/my-summary', { query: { userId } });

export const getReferralCode = async (userId: string): Promise<ReferralCodeResponse> =>
  apiRequest('/referrals/my-code', { query: { userId } });

export const resolveReferralCode = async (code: string): Promise<ReferralCodeResolution> =>
  apiRequest(`/referrals/resolve/${code}`);

export const attributeReferral = async (data: {
  code: string;
  channel: 'whatsapp' | 'qr' | 'copy' | 'link';
  userId?: string;
  referredPhone?: string;
  referredEmail?: string;
}): Promise<{ attributionId: string; expiresAt: string }> =>
  apiRequest('/referrals/attribute', { method: 'POST', body: data });

export const getRewardsWallet = async (userId: string): Promise<RewardWalletSummary> =>
  apiRequest('/rewards/wallet', { query: { userId } });

export const getReferralConfig = async (): Promise<ReferralProgramConfig> =>
  apiRequest('/admin/referrals/config');

export const updateReferralConfig = async (data: Partial<ReferralProgramConfig>): Promise<ReferralProgramConfig> =>
  apiRequest('/admin/referrals/config', { method: 'PUT', body: data });

export const copyReferralConfig = async (sourceLocationId: string): Promise<ReferralProgramConfig> =>
  apiRequest('/admin/referrals/config/copy-from', { method: 'POST', body: { sourceLocationId } });

export const applyReferralTemplate = async (templateId: string): Promise<ReferralProgramConfig> =>
  apiRequest('/admin/referrals/config/apply-template', { method: 'POST', body: { templateId } });

export const getReferralTemplatesForLocal = async (): Promise<ReferralConfigTemplate[]> =>
  apiRequest('/admin/referrals/templates');

export const getReferralOverview = async (params?: { from?: string; to?: string }) =>
  apiRequest('/admin/referrals/overview', { query: params });

export const getReferralList = async (params?: {
  status?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ total: number; items: ReferralAttributionItem[] }> =>
  apiRequest('/admin/referrals/list', { query: params });

export const voidReferral = async (id: string, reason?: string) =>
  apiRequest(`/admin/referrals/void/${id}`, { method: 'POST', body: { reason } });
