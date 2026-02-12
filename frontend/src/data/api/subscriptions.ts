import {
  AssignUserSubscriptionPayload,
  CreateSubscriptionPlanPayload,
  PaymentMethod,
  PaginatedResponse,
  SubscribePlanPayload,
  SubscribePlanResponse,
  SubscriptionPlan,
  UserSubscription,
} from '@/data/types';

import { apiRequest } from './request';

export const getSubscriptionPlans = async (includeArchived = false): Promise<SubscriptionPlan[]> =>
  apiRequest('/subscriptions/plans', {
    query: { includeArchived: includeArchived ? '1' : undefined },
  });

export const getActiveSubscriptionPlans = async (): Promise<SubscriptionPlan[]> =>
  apiRequest('/subscriptions/plans/active');

export const createSubscriptionPlan = async (
  data: CreateSubscriptionPlanPayload,
): Promise<SubscriptionPlan> =>
  apiRequest('/subscriptions/plans', { method: 'POST', body: data });

export const updateSubscriptionPlan = async (
  id: string,
  data: Partial<CreateSubscriptionPlanPayload>,
): Promise<SubscriptionPlan> =>
  apiRequest(`/subscriptions/plans/${id}`, { method: 'PATCH', body: data });

export const archiveSubscriptionPlan = async (id: string): Promise<void> =>
  apiRequest(`/subscriptions/plans/${id}`, { method: 'DELETE' });

export const getUserSubscriptions = async (
  userId: string,
  params?: { page?: number; pageSize?: number },
): Promise<PaginatedResponse<UserSubscription>> =>
  apiRequest(`/subscriptions/users/${userId}`, {
    query: {
      page: params?.page,
      pageSize: params?.pageSize,
    },
  });

export const getUserActiveSubscription = async (
  userId: string,
  referenceDate?: string,
): Promise<UserSubscription | null> =>
  apiRequest(`/subscriptions/users/${userId}/active`, {
    query: { referenceDate },
  });

export const assignUserSubscription = async (
  userId: string,
  data: AssignUserSubscriptionPayload,
): Promise<UserSubscription> =>
  apiRequest(`/subscriptions/users/${userId}/assign`, { method: 'POST', body: data });

export const getMySubscriptions = async (): Promise<UserSubscription[]> =>
  apiRequest('/subscriptions/me');

export const getMyActiveSubscription = async (referenceDate?: string): Promise<UserSubscription | null> =>
  apiRequest('/subscriptions/me/active', {
    query: { referenceDate },
  });

export const subscribeToPlan = async (data: SubscribePlanPayload): Promise<SubscribePlanResponse> =>
  apiRequest('/subscriptions/subscribe', { method: 'POST', body: data });

export const markUserSubscriptionPaid = async (
  userId: string,
  subscriptionId: string,
  data?: { paymentMethod?: PaymentMethod; paidAt?: string },
): Promise<UserSubscription> =>
  apiRequest(`/subscriptions/users/${userId}/${subscriptionId}/mark-paid`, {
    method: 'POST',
    body: data ?? {},
  });
