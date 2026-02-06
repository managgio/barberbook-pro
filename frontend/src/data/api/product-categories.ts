import { ProductCategory } from '@/data/types';

import { apiRequest } from './request';

export const getProductCategories = async (withProducts = true): Promise<ProductCategory[]> =>
  apiRequest('/product-categories', { query: { withProducts } });

export const createProductCategory = async (
  data: Omit<ProductCategory, 'id' | 'products'>,
): Promise<ProductCategory> =>
  apiRequest('/product-categories', { method: 'POST', body: data });

export const updateProductCategory = async (
  id: string,
  data: Partial<Omit<ProductCategory, 'id' | 'products'>>,
): Promise<ProductCategory> => apiRequest(`/product-categories/${id}`, { method: 'PATCH', body: data });

export const deleteProductCategory = async (id: string): Promise<void> =>
  apiRequest(`/product-categories/${id}`, { method: 'DELETE' });
