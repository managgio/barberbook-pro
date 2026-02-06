import { ClientNote } from '@/data/types';

import { apiRequest } from './request';

export const getClientNotes = async (userId: string): Promise<ClientNote[]> =>
  apiRequest('/client-notes', { query: { userId } });

export const createClientNote = async (data: { userId: string; content: string }): Promise<ClientNote> =>
  apiRequest('/client-notes', { method: 'POST', body: data });

export const updateClientNote = async (id: string, data: { content: string }): Promise<ClientNote> =>
  apiRequest(`/client-notes/${id}`, { method: 'PATCH', body: data });

export const deleteClientNote = async (id: string): Promise<void> =>
  apiRequest(`/client-notes/${id}`, { method: 'DELETE' });
