import {
  LegalPolicyResponse,
  LegalSettings,
  OperationSuccessResponse,
  PlatformBrandAdminsOverview,
  PlatformBrandConfigRecord,
  PlatformBrandSummary,
  PlatformConfigData,
  PlatformLocationConfigRecord,
  PlatformLocationSummary,
  PlatformUsageMetrics,
  StripeOnboardingResponse,
} from '@/data/types';

import { apiRequest } from './request';

export const getPlatformBrands = async (): Promise<PlatformBrandSummary[]> =>
  apiRequest('/platform/brands');

export const getPlatformMetrics = async (windowDays = 7): Promise<PlatformUsageMetrics> =>
  apiRequest(`/platform/metrics?window=${windowDays}`);

export const refreshPlatformMetrics = async (windowDays = 7): Promise<PlatformUsageMetrics> =>
  apiRequest(`/platform/metrics/refresh?window=${windowDays}`, {
    method: 'POST',
  });

export const getPlatformBrand = async (brandId: string): Promise<PlatformBrandSummary> =>
  apiRequest(`/platform/brands/${brandId}`);

export const createPlatformBrand = async (
  data: { name: string; subdomain: string; customDomain?: string | null; isActive?: boolean },
): Promise<PlatformBrandSummary> =>
  apiRequest('/platform/brands', {
    method: 'POST',
    body: data,
  });

export const updatePlatformBrand = async (
  brandId: string,
  data: Partial<{ name: string; subdomain: string; customDomain?: string | null; isActive?: boolean; defaultLocationId?: string | null }>,
): Promise<PlatformBrandSummary> =>
  apiRequest(`/platform/brands/${brandId}`, {
    method: 'PATCH',
    body: data,
  });

export const deletePlatformBrand = async (brandId: string): Promise<void> =>
  apiRequest(`/platform/brands/${brandId}`, {
    method: 'DELETE',
  });

export const getPlatformLocations = async (brandId: string): Promise<PlatformLocationSummary[]> =>
  apiRequest(`/platform/brands/${brandId}/locations`);

export const createPlatformLocation = async (
  brandId: string,
  data: { name: string; slug?: string | null; isActive?: boolean },
): Promise<PlatformLocationSummary> =>
  apiRequest(`/platform/brands/${brandId}/locations`, {
    method: 'POST',
    body: data,
  });

export const updatePlatformLocation = async (
  localId: string,
  data: Partial<{ name: string; slug?: string | null; isActive?: boolean }>,
): Promise<PlatformLocationSummary> =>
  apiRequest(`/platform/locations/${localId}`, {
    method: 'PATCH',
    body: data,
  });

export const deletePlatformLocation = async (localId: string): Promise<void> =>
  apiRequest(`/platform/locations/${localId}`, {
    method: 'DELETE',
  });

export const getPlatformBrandConfig = async (brandId: string): Promise<PlatformConfigData> =>
  apiRequest(`/platform/brands/${brandId}/config`);

export const updatePlatformBrandConfig = async (
  brandId: string,
  data: Record<string, unknown>,
): Promise<PlatformBrandConfigRecord> =>
  apiRequest(`/platform/brands/${brandId}/config`, {
    method: 'PATCH',
    body: { data },
  });

export const getPlatformLocationConfig = async (localId: string): Promise<PlatformConfigData> =>
  apiRequest(`/platform/locations/${localId}/config`);

export const updatePlatformLocationConfig = async (
  localId: string,
  data: Record<string, unknown>,
): Promise<PlatformLocationConfigRecord> =>
  apiRequest(`/platform/locations/${localId}/config`, {
    method: 'PATCH',
    body: { data },
  });

export const connectPlatformStripeBrand = async (brandId: string): Promise<StripeOnboardingResponse> =>
  apiRequest(`/platform/payments/stripe/brand/${brandId}/connect`, {
    method: 'POST',
  });

export const connectPlatformStripeLocation = async (localId: string): Promise<StripeOnboardingResponse> =>
  apiRequest(`/platform/payments/stripe/location/${localId}/connect`, {
    method: 'POST',
  });

export const getPlatformBrandLegalSettings = async (brandId: string): Promise<LegalSettings> =>
  apiRequest(`/platform/brands/${brandId}/legal/settings`);

export const updatePlatformBrandLegalSettings = async (
  brandId: string,
  data: Partial<LegalSettings>,
): Promise<LegalSettings> =>
  apiRequest(`/platform/brands/${brandId}/legal/settings`, {
    method: 'PUT',
    body: data,
  });

export const getPlatformBrandDpa = async (brandId: string): Promise<LegalPolicyResponse> =>
  apiRequest(`/platform/brands/${brandId}/legal/dpa`);

export const getPlatformBrandAdmins = async (brandId: string): Promise<PlatformBrandAdminsOverview> =>
  apiRequest(`/platform/brands/${brandId}/admins`);

export const assignPlatformBrandAdmin = async (
  brandId: string,
  data: { email: string; localId?: string; applyToAll?: boolean; adminRoleId?: string | null },
): Promise<OperationSuccessResponse> =>
  apiRequest(`/platform/brands/${brandId}/admins`, {
    method: 'POST',
    body: data,
  });

export const removePlatformBrandAdmin = async (
  brandId: string,
  data: { userId?: string; email?: string; localId?: string; removeFromAll?: boolean },
): Promise<OperationSuccessResponse> =>
  apiRequest(`/platform/brands/${brandId}/admins`, {
    method: 'DELETE',
    body: data,
  });
