import { User } from '@/data/types';

import { apiRequest } from './request';

export const getUserByEmail = async (email: string): Promise<User | undefined> =>
  apiRequest('/users/by-email', { query: { email }, skip404: true });

export const getUserByFirebaseUid = async (firebaseUid: string): Promise<User | undefined> =>
  apiRequest(`/users/by-firebase/${firebaseUid}`, { skip404: true });

export const createUser = async (data: Omit<User, 'id'> & { id?: string }): Promise<User> =>
  apiRequest('/users', { method: 'POST', body: data });

export const updateUser = async (id: string, data: Partial<User>): Promise<User> =>
  apiRequest(`/users/${id}`, { method: 'PATCH', body: data });
