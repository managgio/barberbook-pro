import { Service } from '@/data/types';

import { apiRequest } from './request';

export const getServices = async (options?: { includeArchived?: boolean }): Promise<Service[]> =>
  apiRequest('/services', { query: { includeArchived: options?.includeArchived ? 'true' : undefined } });

export const getServiceById = async (id: string): Promise<Service | undefined> =>
  apiRequest(`/services/${id}`);

export const createService = async (data: Omit<Service, 'id'>): Promise<Service> =>
  apiRequest('/services', { method: 'POST', body: data });

export const updateService = async (id: string, data: Partial<Service>): Promise<Service> =>
  apiRequest(`/services/${id}`, { method: 'PATCH', body: data });

export const deleteService = async (id: string): Promise<void> =>
  apiRequest(`/services/${id}`, { method: 'DELETE' });
