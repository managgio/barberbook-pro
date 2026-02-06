import { AdminRole } from '@/data/types';

import { apiRequest } from './request';

export const getAdminRoles = async (): Promise<AdminRole[]> =>
  apiRequest('/roles');

export const createAdminRole = async (data: Omit<AdminRole, 'id'>): Promise<AdminRole> =>
  apiRequest('/roles', { method: 'POST', body: data });

export const updateAdminRole = async (id: string, data: Partial<AdminRole>): Promise<AdminRole> =>
  apiRequest(`/roles/${id}`, { method: 'PATCH', body: data });

export const deleteAdminRole = async (id: string): Promise<void> =>
  apiRequest(`/roles/${id}`, { method: 'DELETE' });
