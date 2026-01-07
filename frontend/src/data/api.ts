import { 
  User,
  Barber,
  Service,
  Appointment,
  Alert,
  ShopSchedule,
  HolidayRange,
  AdminRole,
  SiteSettings,
} from './types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

type QueryParams = Record<string, string | number | undefined | null>;

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: QueryParams;
  skip404?: boolean;
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
  const { method = 'GET', body, query, skip404 } = options;
  const url = buildUrl(path.startsWith('http') ? path : `${API_BASE}${path}`, query);
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    if (skip404 && response.status === 404) {
      return undefined as T;
    }
    const message = await response.text();
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

// Appointments API
export const getAppointments = async (): Promise<Appointment[]> => apiRequest('/appointments');
export const getAppointmentById = async (id: string): Promise<Appointment | undefined> => apiRequest(`/appointments/${id}`);
export const getAppointmentsByUser = async (userId: string): Promise<Appointment[]> =>
  apiRequest('/appointments', { query: { userId } });
export const getAppointmentsByBarber = async (barberId: string): Promise<Appointment[]> =>
  apiRequest('/appointments', { query: { barberId } });
export const getAppointmentsByDate = async (date: string): Promise<Appointment[]> =>
  apiRequest('/appointments', { query: { date } });
export const createAppointment = async (data: Omit<Appointment, 'id'>): Promise<Appointment> =>
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
