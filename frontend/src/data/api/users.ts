import { PaginatedResponse, User } from '@/data/types';

import { apiRequest } from './request';

export type UserWritePayload = Partial<
  Pick<
    User,
    | 'firebaseUid'
    | 'name'
    | 'email'
    | 'phone'
    | 'role'
    | 'prefersBarberSelection'
    | 'avatar'
    | 'adminRoleId'
    | 'isSuperAdmin'
    | 'isPlatformAdmin'
  >
> & {
  notificationEmail?: boolean;
  notificationWhatsapp?: boolean;
  notificationSms?: boolean;
};

export const getUsersByIds = async (ids: string[]): Promise<User[]> => {
  if (ids.length === 0) return [];
  return apiRequest('/users', { query: { ids: ids.join(',') } });
};

export const getUsersPage = async (
  params?: { page?: number; pageSize?: number; role?: 'client' | 'admin'; q?: string },
): Promise<PaginatedResponse<User>> =>
  apiRequest('/users', {
    query: {
      page: params?.page,
      pageSize: params?.pageSize,
      role: params?.role,
      q: params?.q,
    },
  });

export const getUserById = async (id: string): Promise<User | undefined> =>
  apiRequest(`/users/${id}`);

export const getUserByEmail = async (email: string): Promise<User | undefined> =>
  apiRequest('/users/by-email', { query: { email }, skip404: true });

export const getUserByFirebaseUid = async (firebaseUid: string): Promise<User | undefined> =>
  apiRequest(`/users/by-firebase/${firebaseUid}`, { skip404: true });

export const createUser = async (data: UserWritePayload): Promise<User> =>
  apiRequest('/users', { method: 'POST', body: data });

export const updateUser = async (id: string, data: UserWritePayload): Promise<User> =>
  apiRequest(`/users/${id}`, { method: 'PATCH', body: data });

export const updateUserBlockStatus = async (id: string, blocked: boolean): Promise<User> =>
  apiRequest(`/users/${id}/block`, { method: 'PATCH', body: { blocked } });

export const deleteUser = async (id: string): Promise<void> =>
  apiRequest(`/users/${id}`, { method: 'DELETE' });
