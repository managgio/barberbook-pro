import {
  ExtraordinaryOpeningConflictSummary,
  ExtraordinaryOpeningsByDate,
  ShopSchedule,
} from '@/data/types';

import { apiRequest } from './request';

export const getShopSchedule = async (): Promise<ShopSchedule> =>
  apiRequest('/schedules/shop');

export const updateShopSchedule = async (schedule: ShopSchedule): Promise<ShopSchedule> =>
  apiRequest('/schedules/shop', { method: 'PUT', body: { schedule } });

export const updateExtraordinaryOpenings = async (
  extraordinaryOpenings: ExtraordinaryOpeningsByDate,
): Promise<ShopSchedule> => apiRequest('/schedules/shop/extraordinary-openings', {
  method: 'PUT',
  body: { extraordinaryOpenings },
});

export const getExtraordinaryOpeningConflicts = async (params: {
  date: string;
  allProfessionals: boolean;
  barberIds: string[];
}): Promise<ExtraordinaryOpeningConflictSummary> => apiRequest(
  '/schedules/shop/extraordinary-openings/conflicts',
  { method: 'POST', body: params },
);
