import {
  AdminCalendarResponse,
  AdminDashboardSummary,
  AdminSearchAppointmentsResponse,
  Appointment,
  CreateAppointmentPayload,
  PaginatedResponse,
} from '@/data/types';

import { apiRequest } from './request';

const MAX_APPOINTMENTS_PAGE_REQUESTS = 50;

const collectAppointmentPages = async (
  fetchPage: (page: number, pageSize: number) => Promise<PaginatedResponse<Appointment>>,
  pageSize = 200,
): Promise<Appointment[]> => {
  const items: Appointment[] = [];
  let page = 1;
  let hasMore = true;
  let requests = 0;

  while (hasMore && requests < MAX_APPOINTMENTS_PAGE_REQUESTS) {
    const response = await fetchPage(page, pageSize);
    items.push(...response.items);
    hasMore = response.hasMore;
    page += 1;
    requests += 1;
  }

  return items;
};

export const getAdminCalendarData = async (
  params: { dateFrom?: string; dateTo?: string; date?: string; barberId?: string; sort?: 'asc' | 'desc' },
): Promise<AdminCalendarResponse> =>
  apiRequest('/appointments/admin-calendar', {
    query: {
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      date: params.date,
      barberId: params.barberId,
      sort: params.sort,
    },
  });

export const getAdminDashboardSummary = async (
  params?: { windowDays?: number; barberId?: string | null },
): Promise<AdminDashboardSummary> =>
  apiRequest('/appointments/dashboard-summary', {
    query: {
      window: params?.windowDays,
      barberId: params?.barberId || undefined,
    },
  });

export const getBarberWeeklyLoad = async (
  dateFrom: string,
  dateTo: string,
  barberIds?: string[],
): Promise<Record<string, number>> => {
  const response = await apiRequest<{ counts: Record<string, number> }>('/appointments/weekly-load', {
    query: {
      dateFrom,
      dateTo,
      barberIds: barberIds && barberIds.length > 0 ? barberIds.join(',') : undefined,
    },
  });
  return response.counts;
};

export const getAppointmentsPage = async (
  params?: {
    page?: number;
    pageSize?: number;
    userId?: string;
    barberId?: string;
    date?: string;
    dateFrom?: string;
    dateTo?: string;
    sort?: 'asc' | 'desc';
  },
): Promise<PaginatedResponse<Appointment>> =>
  apiRequest('/appointments', {
    query: {
      page: params?.page,
      pageSize: params?.pageSize,
      userId: params?.userId,
      barberId: params?.barberId,
      date: params?.date,
      dateFrom: params?.dateFrom,
      dateTo: params?.dateTo,
      sort: params?.sort,
    },
  });

export const getAdminSearchAppointments = async (
  params?: {
    page?: number;
    pageSize?: number;
    barberId?: string;
    date?: string;
    dateFrom?: string;
    dateTo?: string;
    sort?: 'asc' | 'desc';
  },
): Promise<AdminSearchAppointmentsResponse> =>
  apiRequest('/appointments/admin-search', {
    query: {
      page: params?.page,
      pageSize: params?.pageSize,
      barberId: params?.barberId,
      date: params?.date,
      dateFrom: params?.dateFrom,
      dateTo: params?.dateTo,
      sort: params?.sort,
    },
  });

export const getAppointmentsByDateRange = async (dateFrom: string, dateTo: string): Promise<Appointment[]> =>
  collectAppointmentPages((page, pageSize) =>
    getAppointmentsPage({ dateFrom, dateTo, page, pageSize, sort: 'asc' }),
  );

export const getAppointmentById = async (id: string): Promise<Appointment | undefined> =>
  apiRequest(`/appointments/${id}`);

export const getAppointmentsByUser = async (userId: string): Promise<Appointment[]> =>
  collectAppointmentPages((page, pageSize) =>
    getAppointmentsPage({ userId, page, pageSize, sort: 'asc' }),
  );

export const getAppointmentsByBarber = async (barberId: string): Promise<Appointment[]> =>
  collectAppointmentPages((page, pageSize) =>
    getAppointmentsPage({ barberId, page, pageSize, sort: 'asc' }),
  );

export const getAppointmentsByDate = async (date: string): Promise<Appointment[]> =>
  collectAppointmentPages((page, pageSize) =>
    getAppointmentsPage({ date, page, pageSize, sort: 'asc' }),
  );

export const getAppointmentsByDateForLocal = async (date: string, localId: string): Promise<Appointment[]> =>
  collectAppointmentPages((page, pageSize) =>
    apiRequest('/appointments', {
      query: { date, page, pageSize, sort: 'asc' },
      headers: { 'x-local-id': localId },
    }),
  );

export const createAppointment = async (data: CreateAppointmentPayload): Promise<Appointment> =>
  apiRequest('/appointments', { method: 'POST', body: data });

export const updateAppointment = async (
  id: string,
  data: Partial<Appointment> & { products?: Array<{ productId: string; quantity: number }> },
): Promise<Appointment> => apiRequest(`/appointments/${id}`, { method: 'PATCH', body: data });

export const deleteAppointment = async (id: string): Promise<void> =>
  apiRequest(`/appointments/${id}`, { method: 'DELETE' });

export const anonymizeAppointment = async (id: string): Promise<Appointment> =>
  apiRequest(`/appointments/${id}/anonymize`, { method: 'POST' });

export const getAvailableSlots = async (
  barberId: string,
  date: string,
  options?: { serviceId?: string; appointmentIdToIgnore?: string },
): Promise<string[]> =>
  apiRequest('/appointments/availability', {
    query: {
      barberId,
      date,
      serviceId: options?.serviceId,
      appointmentIdToIgnore: options?.appointmentIdToIgnore,
    },
  });

export const getAvailableSlotsBatch = async (
  date: string,
  barberIds: string[],
  options?: { serviceId?: string; appointmentIdToIgnore?: string },
): Promise<Record<string, string[]>> => {
  const normalizedBarberIds = Array.from(new Set(barberIds)).filter(Boolean);
  if (normalizedBarberIds.length === 0) return {};
  return apiRequest('/appointments/availability-batch', {
    query: {
      date,
      barberIds: normalizedBarberIds.join(','),
      serviceId: options?.serviceId,
      appointmentIdToIgnore: options?.appointmentIdToIgnore,
    },
  });
};
