import { Alert } from '@/data/types';

import { apiRequest } from './request';

export const getAlerts = async (): Promise<Alert[]> =>
  apiRequest('/alerts');

export const getActiveAlerts = async (): Promise<Alert[]> =>
  apiRequest('/alerts/active');

export const createAlert = async (data: Omit<Alert, 'id'>): Promise<Alert> =>
  apiRequest('/alerts', { method: 'POST', body: data });

export const updateAlert = async (id: string, data: Partial<Alert>): Promise<Alert> =>
  apiRequest(`/alerts/${id}`, { method: 'PATCH', body: data });

export const deleteAlert = async (id: string): Promise<void> =>
  apiRequest(`/alerts/${id}`, { method: 'DELETE' });
