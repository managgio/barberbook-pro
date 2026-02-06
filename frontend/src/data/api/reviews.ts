import {
  ReviewFeedbackItem,
  ReviewMetrics,
  ReviewPendingResponse,
  ReviewProgramConfig,
} from '@/data/types';

import { apiRequest } from './request';

export const getReviewConfig = async (): Promise<ReviewProgramConfig> =>
  apiRequest('/admin/reviews/config');

export const updateReviewConfig = async (data: Partial<ReviewProgramConfig>): Promise<ReviewProgramConfig> =>
  apiRequest('/admin/reviews/config', { method: 'PUT', body: data });

export const getReviewMetrics = async (params?: { from?: string; to?: string }): Promise<ReviewMetrics> =>
  apiRequest('/admin/reviews/metrics', { query: params });

export const getReviewFeedback = async (params?: {
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ total: number; items: ReviewFeedbackItem[] }> =>
  apiRequest('/admin/reviews/feedback', { query: params });

export const resolveReviewFeedback = async (id: string): Promise<void> =>
  apiRequest(`/admin/reviews/feedback/${id}/resolve`, { method: 'POST' });

export const getPendingReview = async (params: {
  userId?: string;
  guestEmail?: string;
  guestPhone?: string;
}): Promise<ReviewPendingResponse | null> =>
  apiRequest('/reviews/pending', { query: params, skip404: true });

export const markReviewShown = async (id: string, actor: { userId?: string; guestEmail?: string; guestPhone?: string }) =>
  apiRequest(`/reviews/${id}/shown`, { method: 'POST', body: actor });

export const rateReview = async (
  id: string,
  data: { rating: number; userId?: string; guestEmail?: string; guestPhone?: string },
): Promise<{ next: 'GOOGLE' | 'FEEDBACK'; googleReviewUrl?: string | null; ctaText?: string; message?: string }> =>
  apiRequest(`/reviews/${id}/rate`, { method: 'POST', body: data });

export const sendReviewFeedback = async (
  id: string,
  data: { text: string; userId?: string; guestEmail?: string; guestPhone?: string },
): Promise<void> => apiRequest(`/reviews/${id}/feedback`, { method: 'POST', body: data });

export const clickReview = async (id: string, actor: { userId?: string; guestEmail?: string; guestPhone?: string }) =>
  apiRequest(`/reviews/${id}/click`, { method: 'POST', body: actor });

export const snoozeReview = async (id: string, actor: { userId?: string; guestEmail?: string; guestPhone?: string }) =>
  apiRequest(`/reviews/${id}/snooze`, { method: 'POST', body: actor });
