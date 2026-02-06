import { TenantBootstrap } from '@/data/types';

import { apiRequest } from './request';

export const getTenantBootstrap = async (): Promise<TenantBootstrap> =>
  apiRequest('/tenant/bootstrap');
