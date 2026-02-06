import { ShopSchedule } from '@/data/types';

import { apiRequest } from './request';

export const getShopSchedule = async (): Promise<ShopSchedule> =>
  apiRequest('/schedules/shop');

export const updateShopSchedule = async (schedule: ShopSchedule): Promise<ShopSchedule> =>
  apiRequest('/schedules/shop', { method: 'PUT', body: { schedule } });
