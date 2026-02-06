import { LegalPolicyResponse, PrivacyConsentStatus } from '@/data/types';

import { apiRequest } from './request';

export const getPrivacyPolicy = async (): Promise<LegalPolicyResponse> =>
  apiRequest('/legal/privacy');

export const getCookiePolicy = async (): Promise<LegalPolicyResponse> =>
  apiRequest('/legal/cookies');

export const getLegalNotice = async (): Promise<LegalPolicyResponse> =>
  apiRequest('/legal/notice');

export const getPrivacyConsentStatus = async (userId: string): Promise<PrivacyConsentStatus> =>
  apiRequest('/legal/privacy/consent-status', { query: { userId } });
