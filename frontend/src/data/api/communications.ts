import {
  CommunicationCampaignDetail,
  CommunicationCampaignSummary,
  CommunicationPayload,
  CommunicationPreviewResult,
  CommunicationTemplate,
  PaginatedResponse,
} from '@/data/types';
import { apiRequest } from './request';

export const getCommunicationTemplates = async (): Promise<CommunicationTemplate[]> =>
  apiRequest('/admin/communications/templates');

export const getCommunicationChannelPreference = async (): Promise<{ channel: 'email' | 'sms' | 'whatsapp' }> =>
  apiRequest('/admin/communications/channel-preference');

export const updateCommunicationChannelPreference = async (channel: 'email' | 'sms' | 'whatsapp') =>
  apiRequest('/admin/communications/channel-preference', {
    method: 'PATCH',
    body: { channel },
  });

export const listCommunications = async (params: {
  page: number;
  pageSize: number;
  status?: string;
}): Promise<PaginatedResponse<CommunicationCampaignSummary>> => {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
    ...(params.status ? { status: params.status } : {}),
  });
  return apiRequest(`/admin/communications?${query.toString()}`);
};

export const getCommunicationDetail = async (campaignId: string): Promise<CommunicationCampaignDetail> =>
  apiRequest(`/admin/communications/${campaignId}`);

export const previewCommunication = async (payload: CommunicationPayload): Promise<CommunicationPreviewResult> =>
  apiRequest('/admin/communications/preview', {
    method: 'POST',
    body: payload,
  });

export const createCommunication = async (payload: CommunicationPayload & {
  saveAsDraft?: boolean;
  executeNow?: boolean;
  idempotencyKey?: string;
}): Promise<CommunicationCampaignDetail> =>
  apiRequest('/admin/communications', {
    method: 'POST',
    body: payload,
  });

export const updateCommunicationDraft = async (
  campaignId: string,
  payload: Partial<CommunicationPayload>,
): Promise<CommunicationCampaignDetail> =>
  apiRequest(`/admin/communications/${campaignId}/draft`, {
    method: 'PATCH',
    body: payload,
  });

export const executeCommunication = async (campaignId: string, idempotencyKey?: string): Promise<CommunicationCampaignDetail> =>
  apiRequest(`/admin/communications/${campaignId}/execute`, {
    method: 'POST',
    body: {
      ...(idempotencyKey ? { idempotencyKey } : {}),
    },
  });

export const duplicateCommunication = async (campaignId: string): Promise<CommunicationCampaignDetail> =>
  apiRequest(`/admin/communications/${campaignId}/duplicate`, {
    method: 'POST',
  });

export const cancelScheduledCommunication = async (campaignId: string): Promise<CommunicationCampaignDetail> =>
  apiRequest(`/admin/communications/${campaignId}/cancel-scheduled`, {
    method: 'POST',
  });
