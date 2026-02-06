import { ServiceCategory } from '@/data/types';

import { apiRequest } from './request';

export const getServiceCategories = async (withServices = true): Promise<ServiceCategory[]> =>
  apiRequest('/service-categories', { query: { withServices } });

export const createServiceCategory = async (
  data: Omit<ServiceCategory, 'id' | 'services'>,
): Promise<ServiceCategory> =>
  apiRequest('/service-categories', { method: 'POST', body: data });

export const updateServiceCategory = async (
  id: string,
  data: Partial<Omit<ServiceCategory, 'id' | 'services'>>,
): Promise<ServiceCategory> => apiRequest(`/service-categories/${id}`, { method: 'PATCH', body: data });

export const deleteServiceCategory = async (id: string): Promise<void> =>
  apiRequest(`/service-categories/${id}`, { method: 'DELETE' });
