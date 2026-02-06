import { Product } from '@/data/types';

import { apiRequest } from './request';

export const getProducts = async (context: 'booking' | 'landing' = 'booking'): Promise<Product[]> =>
  apiRequest('/products', { query: { context } });

export const getAdminProducts = async (): Promise<Product[]> =>
  apiRequest('/products/admin');

export const createProduct = async (data: Partial<Product>): Promise<Product> =>
  apiRequest('/products', { method: 'POST', body: data });

export const updateProduct = async (id: string, data: Partial<Product>): Promise<Product> =>
  apiRequest(`/products/${id}`, { method: 'PATCH', body: data });

export const deleteProduct = async (id: string): Promise<void> =>
  apiRequest(`/products/${id}`, { method: 'DELETE' });

export const importProducts = async (data: { sourceLocalId: string; targetLocalId?: string }): Promise<{ created: number; updated: number }> =>
  apiRequest('/products/import', { method: 'POST', body: data });
