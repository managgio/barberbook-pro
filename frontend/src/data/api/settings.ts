import { SiteSettings } from '@/data/types';

import { apiRequest } from './request';

export const getSiteSettings = async (): Promise<SiteSettings> =>
  apiRequest('/settings');
