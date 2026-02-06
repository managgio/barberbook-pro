import { Offer, OfferTarget } from '@/data/types';

import { apiRequest } from './request';

export const getOffers = async (target?: OfferTarget): Promise<Offer[]> =>
  apiRequest('/offers', { query: target ? { target } : undefined });

export const getActiveOffers = async (target?: OfferTarget): Promise<Offer[]> =>
  apiRequest('/offers/active', { query: target ? { target } : undefined });

export const createOffer = async (data: Omit<Offer, 'id' | 'categories' | 'services' | 'productCategories' | 'products'> & {
  categoryIds?: string[];
  serviceIds?: string[];
  productCategoryIds?: string[];
  productIds?: string[];
}): Promise<Offer> => apiRequest('/offers', { method: 'POST', body: data });

export const updateOffer = async (
  id: string,
  data: Partial<Omit<Offer, 'id' | 'categories' | 'services' | 'productCategories' | 'products'>> & {
    categoryIds?: string[];
    serviceIds?: string[];
    productCategoryIds?: string[];
    productIds?: string[];
  },
): Promise<Offer> => apiRequest(`/offers/${id}`, { method: 'PATCH', body: data });

export const deleteOffer = async (id: string): Promise<void> =>
  apiRequest(`/offers/${id}`, { method: 'DELETE' });
