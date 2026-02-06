import { SiteSettings } from '@/data/types';

import { apiRequest } from './request';

export const getSiteSettings = async (): Promise<SiteSettings> =>
  apiRequest('/settings');

export const updateSiteSettings = async (settings: SiteSettings): Promise<SiteSettings> =>
  apiRequest('/settings', { method: 'PUT', body: { settings } });
