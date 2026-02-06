import { HolidayRange } from '@/data/types';

import { apiRequest } from './request';

export const getHolidaysGeneral = async (): Promise<HolidayRange[]> =>
  apiRequest('/holidays/general');

export const getHolidaysByBarber = async (barberId: string): Promise<HolidayRange[]> =>
  apiRequest(`/holidays/barbers/${barberId}`);

export const addGeneralHolidayRange = async (range: HolidayRange): Promise<HolidayRange[]> =>
  apiRequest('/holidays/general', { method: 'POST', body: range });

export const removeGeneralHolidayRange = async (range: HolidayRange): Promise<HolidayRange[]> =>
  apiRequest('/holidays/general', { method: 'DELETE', body: range });

export const addBarberHolidayRange = async (barberId: string, range: HolidayRange): Promise<HolidayRange[]> =>
  apiRequest(`/holidays/barbers/${barberId}`, { method: 'POST', body: range });

export const removeBarberHolidayRange = async (barberId: string, range: HolidayRange): Promise<HolidayRange[]> =>
  apiRequest(`/holidays/barbers/${barberId}`, { method: 'DELETE', body: range });
