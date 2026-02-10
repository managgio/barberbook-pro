import { Barber, ShopSchedule } from '@/data/types';

import { apiRequest } from './request';

type GetBarbersOptions = {
  serviceId?: string;
};

export const getBarbers = async (options?: GetBarbersOptions): Promise<Barber[]> =>
  apiRequest('/barbers', { query: { serviceId: options?.serviceId } });

export const getAdminBarbers = async (options?: GetBarbersOptions): Promise<Barber[]> =>
  apiRequest('/barbers/admin', { query: { serviceId: options?.serviceId } });

export const getBarberById = async (id: string): Promise<Barber | undefined> =>
  apiRequest(`/barbers/${id}`);

export const createBarber = async (data: Omit<Barber, 'id'>): Promise<Barber> =>
  apiRequest('/barbers', { method: 'POST', body: data });

export const updateBarber = async (id: string, data: Partial<Barber>): Promise<Barber> =>
  apiRequest(`/barbers/${id}`, { method: 'PATCH', body: data });

export const updateBarberServiceAssignment = async (
  id: string,
  data: { serviceIds?: string[]; categoryIds?: string[] },
): Promise<Barber> => apiRequest(`/barbers/${id}/service-assignment`, { method: 'PATCH', body: data });

export const deleteBarber = async (id: string): Promise<void> =>
  apiRequest(`/barbers/${id}`, { method: 'DELETE' });

export const getBarberSchedule = async (barberId: string): Promise<ShopSchedule> =>
  apiRequest(`/schedules/barbers/${barberId}`);

export const updateBarberSchedule = async (barberId: string, schedule: ShopSchedule): Promise<ShopSchedule> =>
  apiRequest(`/schedules/barbers/${barberId}`, { method: 'PUT', body: { schedule } });
