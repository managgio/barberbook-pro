import { 
  User,
  Barber,
  Service,
  Offer,
  ServiceCategory,
  Appointment,
  CreateAppointmentPayload,
  Alert,
  ShopSchedule,
  HolidayRange,
  AdminRole,
  SiteSettings,
  AiChatResponse,
  AiChatSessionResponse,
  TenantBootstrap,
  PlatformUsageMetrics,
} from './types';
import { getStoredLocalId, getTenantSubdomainOverride } from '@/lib/tenant';
import { getAdminUserId } from '@/lib/authStorage';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

type QueryParams = Record<string, string | number | undefined | null>;

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: QueryParams;
  skip404?: boolean;
  headers?: Record<string, string>;
};

const buildUrl = (path: string, query?: QueryParams) => {
  const url = new URL(path, API_BASE.startsWith('http') ? API_BASE : window.location.origin);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
};

const apiRequest = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const { method = 'GET', body, query, skip404, headers } = options;
  const url = buildUrl(path.startsWith('http') ? path : `${API_BASE}${path}`, query);
  const localId = getStoredLocalId();
  const tenantOverride = getTenantSubdomainOverride();
  const adminUserId = getAdminUserId();
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(localId ? { 'x-local-id': localId } : {}),
      ...(tenantOverride ? { 'x-tenant-subdomain': tenantOverride } : {}),
      ...(adminUserId ? { 'x-admin-user-id': adminUserId } : {}),
      ...(headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    if (skip404 && response.status === 404) {
      return undefined as T;
    }
    let message = await response.text();
    try {
      const parsed = JSON.parse(message) as { message?: string; error?: string };
      message = parsed.message || parsed.error || message;
    } catch {
      // Keep raw message when it's not JSON.
    }
    throw new Error(message || `API request failed (${response.status})`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json() as Promise<T>;
  }

  return undefined as T;
};

// Users API
export const getUsers = async (): Promise<User[]> => apiRequest('/users');
export const getUserById = async (id: string): Promise<User | undefined> => apiRequest(`/users/${id}`);
export const getUserByEmail = async (email: string): Promise<User | undefined> =>
  apiRequest(`/users/by-email`, { query: { email }, skip404: true });
export const getUserByFirebaseUid = async (firebaseUid: string): Promise<User | undefined> =>
  apiRequest(`/users/by-firebase/${firebaseUid}`, { skip404: true });
export const createUser = async (data: Omit<User, 'id'> & { id?: string }): Promise<User> =>
  apiRequest('/users', { method: 'POST', body: data });
export const updateUser = async (id: string, data: Partial<User>): Promise<User> =>
  apiRequest(`/users/${id}`, { method: 'PATCH', body: data });
export const deleteUser = async (id: string): Promise<void> =>
  apiRequest(`/users/${id}`, { method: 'DELETE' });

// Tenant API
export const getTenantBootstrap = async (): Promise<TenantBootstrap> =>
  apiRequest('/tenant/bootstrap');

// Barbers API
export const getBarbers = async (): Promise<Barber[]> => apiRequest('/barbers');
export const getBarberById = async (id: string): Promise<Barber | undefined> => apiRequest(`/barbers/${id}`);
export const createBarber = async (data: Omit<Barber, 'id'>): Promise<Barber> =>
  apiRequest('/barbers', { method: 'POST', body: data });
export const updateBarber = async (id: string, data: Partial<Barber>): Promise<Barber> =>
  apiRequest(`/barbers/${id}`, { method: 'PATCH', body: data });
export const deleteBarber = async (id: string): Promise<void> =>
  apiRequest(`/barbers/${id}`, { method: 'DELETE' });

export const getBarberSchedule = async (barberId: string): Promise<ShopSchedule> =>
  apiRequest(`/schedules/barbers/${barberId}`);
export const updateBarberSchedule = async (barberId: string, schedule: ShopSchedule): Promise<ShopSchedule> =>
  apiRequest(`/schedules/barbers/${barberId}`, { method: 'PUT', body: { schedule } });

// Services API
export const getServices = async (): Promise<Service[]> => apiRequest('/services');
export const getServiceById = async (id: string): Promise<Service | undefined> => apiRequest(`/services/${id}`);
export const createService = async (data: Omit<Service, 'id'>): Promise<Service> =>
  apiRequest('/services', { method: 'POST', body: data });
export const updateService = async (id: string, data: Partial<Service>): Promise<Service> =>
  apiRequest(`/services/${id}`, { method: 'PATCH', body: data });
export const deleteService = async (id: string): Promise<void> =>
  apiRequest(`/services/${id}`, { method: 'DELETE' });

// Offers API
export const getOffers = async (): Promise<Offer[]> => apiRequest('/offers');
export const getActiveOffers = async (): Promise<Offer[]> => apiRequest('/offers/active');
export const createOffer = async (data: Omit<Offer, 'id' | 'categories' | 'services'> & {
  categoryIds?: string[];
  serviceIds?: string[];
}): Promise<Offer> => apiRequest('/offers', { method: 'POST', body: data });
export const updateOffer = async (
  id: string,
  data: Partial<Omit<Offer, 'id' | 'categories' | 'services'>> & { categoryIds?: string[]; serviceIds?: string[] },
): Promise<Offer> => apiRequest(`/offers/${id}`, { method: 'PATCH', body: data });
export const deleteOffer = async (id: string): Promise<void> => apiRequest(`/offers/${id}`, { method: 'DELETE' });

// Service Categories API
export const getServiceCategories = async (withServices = true): Promise<ServiceCategory[]> =>
  apiRequest('/service-categories', { query: { withServices } });
export const createServiceCategory = async (
  data: Omit<ServiceCategory, 'id' | 'services'>,
): Promise<ServiceCategory> =>
  apiRequest('/service-categories', { method: 'POST', body: data });
export const updateServiceCategory = async (
  id: string,
  data: Partial<Omit<ServiceCategory, 'id' | 'services'>>,
): Promise<ServiceCategory> => apiRequest(`/service-categories/${id}`, { method: 'PATCH', body: data });
export const deleteServiceCategory = async (id: string): Promise<void> =>
  apiRequest(`/service-categories/${id}`, { method: 'DELETE' });

// Appointments API
export const getAppointments = async (): Promise<Appointment[]> => apiRequest('/appointments');
export const getAppointmentById = async (id: string): Promise<Appointment | undefined> => apiRequest(`/appointments/${id}`);
export const getAppointmentsByUser = async (userId: string): Promise<Appointment[]> =>
  apiRequest('/appointments', { query: { userId } });
export const getAppointmentsByBarber = async (barberId: string): Promise<Appointment[]> =>
  apiRequest('/appointments', { query: { barberId } });
export const getAppointmentsByDate = async (date: string): Promise<Appointment[]> =>
  apiRequest('/appointments', { query: { date } });
export const createAppointment = async (data: CreateAppointmentPayload): Promise<Appointment> =>
  apiRequest('/appointments', { method: 'POST', body: data });
export const updateAppointment = async (id: string, data: Partial<Appointment>): Promise<Appointment> =>
  apiRequest(`/appointments/${id}`, { method: 'PATCH', body: data });
export const deleteAppointment = async (id: string): Promise<void> =>
  apiRequest(`/appointments/${id}`, { method: 'DELETE' });

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

// Admin Roles API
export const getAdminRoles = async (): Promise<AdminRole[]> => apiRequest('/roles');
export const createAdminRole = async (data: Omit<AdminRole, 'id'>): Promise<AdminRole> =>
  apiRequest('/roles', { method: 'POST', body: data });
export const updateAdminRole = async (id: string, data: Partial<AdminRole>): Promise<AdminRole> =>
  apiRequest(`/roles/${id}`, { method: 'PATCH', body: data });
export const deleteAdminRole = async (id: string): Promise<void> =>
  apiRequest(`/roles/${id}`, { method: 'DELETE' });

// Alerts API
export const getAlerts = async (): Promise<Alert[]> => apiRequest('/alerts');
export const getActiveAlerts = async (): Promise<Alert[]> => apiRequest('/alerts/active');
export const createAlert = async (data: Omit<Alert, 'id'>): Promise<Alert> =>
  apiRequest('/alerts', { method: 'POST', body: data });
export const updateAlert = async (id: string, data: Partial<Alert>): Promise<Alert> =>
  apiRequest(`/alerts/${id}`, { method: 'PATCH', body: data });
export const deleteAlert = async (id: string): Promise<void> =>
  apiRequest(`/alerts/${id}`, { method: 'DELETE' });

// Schedule API
export const getShopSchedule = async (): Promise<ShopSchedule> => apiRequest('/schedules/shop');
export const updateShopSchedule = async (schedule: ShopSchedule): Promise<ShopSchedule> =>
  apiRequest('/schedules/shop', { method: 'PUT', body: { schedule } });

// Settings API
export const getSiteSettings = async (): Promise<SiteSettings> => apiRequest('/settings');
export const updateSiteSettings = async (settings: SiteSettings): Promise<SiteSettings> =>
  apiRequest('/settings', { method: 'PUT', body: { settings } });

// Holidays API
export const getHolidaysGeneral = async (): Promise<HolidayRange[]> => apiRequest('/holidays/general');
export const getHolidaysByBarber = async (barberId: string): Promise<HolidayRange[]> =>
  apiRequest(`/holidays/barbers/${barberId}`);
export const addGeneralHolidayRange = async (range: HolidayRange): Promise<HolidayRange[]> =>
  apiRequest('/holidays/general', { method: 'POST', body: range });
export const removeGeneralHolidayRange = async (range: HolidayRange): Promise<HolidayRange[]> =>
  apiRequest('/holidays/general', { method: 'DELETE', body: range });
export const addBarberHolidayRange = async (barberId: string, range: HolidayRange): Promise<HolidayRange[]> =>
  apiRequest(`/holidays/barbers/${barberId}`, { method: 'POST', body: range });
export const removeBarberHolidayRange = async (barberId: string, range: HolidayRange): Promise<HolidayRange[]> =>
  apiRequest(`/holidays/barbers/${barberId}`, { method: 'DELETE', body: range });

export const postAiAssistantChat = async (payload: {
  message: string;
  sessionId?: string | null;
  adminUserId: string;
  role?: string;
}): Promise<AiChatResponse> =>
  apiRequest('/admin/ai-assistant/chat', {
    method: 'POST',
    body: { message: payload.message, sessionId: payload.sessionId || undefined },
    headers: {
      'x-admin-user-id': payload.adminUserId,
      ...(payload.role ? { 'x-user-role': payload.role } : {}),
      ...(getStoredLocalId() ? { 'x-local-id': getStoredLocalId() as string } : {}),
      ...(getTenantSubdomainOverride() ? { 'x-tenant-subdomain': getTenantSubdomainOverride() as string } : {}),
    },
  });

export const getAiAssistantSession = async (payload: {
  sessionId: string;
  adminUserId: string;
  role?: string;
}): Promise<AiChatSessionResponse> =>
  apiRequest(`/admin/ai-assistant/session/${payload.sessionId}`, {
    headers: {
      'x-admin-user-id': payload.adminUserId,
      ...(payload.role ? { 'x-user-role': payload.role } : {}),
      ...(getStoredLocalId() ? { 'x-local-id': getStoredLocalId() as string } : {}),
      ...(getTenantSubdomainOverride() ? { 'x-tenant-subdomain': getTenantSubdomainOverride() as string } : {}),
    },
  });

export const postAiAssistantTranscribe = async (payload: {
  file: File;
  adminUserId: string;
  role?: string;
}): Promise<{ text: string }> => {
  const formData = new FormData();
  formData.append('file', payload.file);
  const url = buildUrl(`${API_BASE}/admin/ai-assistant/transcribe`);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'x-admin-user-id': payload.adminUserId,
      ...(payload.role ? { 'x-user-role': payload.role } : {}),
      ...(getStoredLocalId() ? { 'x-local-id': getStoredLocalId() as string } : {}),
      ...(getTenantSubdomainOverride() ? { 'x-tenant-subdomain': getTenantSubdomainOverride() as string } : {}),
    },
    body: formData,
  });

  if (!response.ok) {
    let message = await response.text();
    try {
      const parsed = JSON.parse(message) as { message?: string; error?: string };
      message = parsed.message || parsed.error || message;
    } catch {
      // Keep raw message when it's not JSON.
    }
    throw new Error(message || `API request failed (${response.status})`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json() as Promise<{ text: string }>;
  }

  return { text: '' };
};

// Platform Admin API
type PlatformAdminHeaders = { 'x-admin-user-id': string };

const withPlatformHeaders = (adminUserId: string): PlatformAdminHeaders => ({
  'x-admin-user-id': adminUserId,
});

export const getPlatformBrands = async (adminUserId: string): Promise<any[]> =>
  apiRequest('/platform/brands', {
    headers: withPlatformHeaders(adminUserId),
  });

export const getPlatformMetrics = async (adminUserId: string, windowDays = 7): Promise<PlatformUsageMetrics> =>
  apiRequest(`/platform/metrics?window=${windowDays}`, {
    headers: withPlatformHeaders(adminUserId),
  });

export const getPlatformBrand = async (adminUserId: string, brandId: string): Promise<any> =>
  apiRequest(`/platform/brands/${brandId}`, {
    headers: withPlatformHeaders(adminUserId),
  });

export const createPlatformBrand = async (
  adminUserId: string,
  data: { name: string; subdomain: string; customDomain?: string | null; isActive?: boolean },
): Promise<any> =>
  apiRequest('/platform/brands', {
    method: 'POST',
    body: data,
    headers: withPlatformHeaders(adminUserId),
  });

export const updatePlatformBrand = async (
  adminUserId: string,
  brandId: string,
  data: Partial<{ name: string; subdomain: string; customDomain?: string | null; isActive?: boolean; defaultLocationId?: string | null }>,
): Promise<any> =>
  apiRequest(`/platform/brands/${brandId}`, {
    method: 'PATCH',
    body: data,
    headers: withPlatformHeaders(adminUserId),
  });

export const deletePlatformBrand = async (adminUserId: string, brandId: string): Promise<void> =>
  apiRequest(`/platform/brands/${brandId}`, {
    method: 'DELETE',
    headers: withPlatformHeaders(adminUserId),
  });

export const getPlatformLocations = async (adminUserId: string, brandId: string): Promise<any[]> =>
  apiRequest(`/platform/brands/${brandId}/locations`, {
    headers: withPlatformHeaders(adminUserId),
  });

export const createPlatformLocation = async (
  adminUserId: string,
  brandId: string,
  data: { name: string; slug?: string | null; isActive?: boolean },
): Promise<any> =>
  apiRequest(`/platform/brands/${brandId}/locations`, {
    method: 'POST',
    body: data,
    headers: withPlatformHeaders(adminUserId),
  });

export const updatePlatformLocation = async (
  adminUserId: string,
  localId: string,
  data: Partial<{ name: string; slug?: string | null; isActive?: boolean }>,
): Promise<any> =>
  apiRequest(`/platform/locations/${localId}`, {
    method: 'PATCH',
    body: data,
    headers: withPlatformHeaders(adminUserId),
  });

export const deletePlatformLocation = async (adminUserId: string, localId: string): Promise<void> =>
  apiRequest(`/platform/locations/${localId}`, {
    method: 'DELETE',
    headers: withPlatformHeaders(adminUserId),
  });

export const getPlatformBrandConfig = async (adminUserId: string, brandId: string): Promise<any> =>
  apiRequest(`/platform/brands/${brandId}/config`, {
    headers: withPlatformHeaders(adminUserId),
  });

export const updatePlatformBrandConfig = async (
  adminUserId: string,
  brandId: string,
  data: Record<string, unknown>,
): Promise<any> =>
  apiRequest(`/platform/brands/${brandId}/config`, {
    method: 'PATCH',
    body: { data },
    headers: withPlatformHeaders(adminUserId),
  });

export const getPlatformLocationConfig = async (adminUserId: string, localId: string): Promise<any> =>
  apiRequest(`/platform/locations/${localId}/config`, {
    headers: withPlatformHeaders(adminUserId),
  });

export const updatePlatformLocationConfig = async (
  adminUserId: string,
  localId: string,
  data: Record<string, unknown>,
): Promise<any> =>
  apiRequest(`/platform/locations/${localId}/config`, {
    method: 'PATCH',
    body: { data },
    headers: withPlatformHeaders(adminUserId),
  });

export const getPlatformBrandAdmins = async (adminUserId: string, brandId: string): Promise<any> =>
  apiRequest(`/platform/brands/${brandId}/admins`, {
    headers: withPlatformHeaders(adminUserId),
  });

export const assignPlatformBrandAdmin = async (
  adminUserId: string,
  brandId: string,
  data: { email: string; localId?: string; applyToAll?: boolean; adminRoleId?: string | null },
): Promise<any> =>
  apiRequest(`/platform/brands/${brandId}/admins`, {
    method: 'POST',
    body: data,
    headers: withPlatformHeaders(adminUserId),
  });

export const removePlatformBrandAdmin = async (
  adminUserId: string,
  brandId: string,
  data: { userId?: string; email?: string; localId?: string; removeFromAll?: boolean },
): Promise<any> =>
  apiRequest(`/platform/brands/${brandId}/admins`, {
    method: 'DELETE',
    body: data,
    headers: withPlatformHeaders(adminUserId),
  });
