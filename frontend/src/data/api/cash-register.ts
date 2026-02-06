import { CashMovement, PaymentMethod } from '@/data/types';

import { apiRequest } from './request';

export const getCashMovements = async (date: string): Promise<CashMovement[]> =>
  apiRequest('/cash-register/movements', { query: { date } });

export const getCashMovementsForLocal = async (date: string, localId: string): Promise<CashMovement[]> =>
  apiRequest('/cash-register/movements', { query: { date }, headers: { 'x-local-id': localId } });

export const createCashMovement = async (data: {
  type: 'in' | 'out';
  amount: number;
  method?: PaymentMethod | null;
  note?: string;
  occurredAt?: string;
  productOperationType?: 'purchase' | 'sale';
  productItems?: Array<{
    productId: string;
    quantity: number;
    unitAmount?: number;
  }>;
}): Promise<CashMovement> => apiRequest('/cash-register/movements', { method: 'POST', body: data });

export const updateCashMovement = async (
  id: string,
  data: Partial<{ type: 'in' | 'out'; amount: number; method?: PaymentMethod | null; note?: string; occurredAt?: string }>,
): Promise<CashMovement> => apiRequest(`/cash-register/movements/${id}`, { method: 'PATCH', body: data });

export const deleteCashMovement = async (id: string): Promise<void> =>
  apiRequest(`/cash-register/movements/${id}`, { method: 'DELETE' });
