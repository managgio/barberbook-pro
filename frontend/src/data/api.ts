import { 
  User,
  PaginatedResponse,
  Barber,
  Service,
  Offer,
  OfferTarget,
  LoyaltyProgram,
  LoyaltySummary,
  LoyaltyPreview,
  CreateLoyaltyProgramPayload,
  ServiceCategory,
  Product,
  ProductCategory,
  Appointment,
  CashMovement,
  ClientNote,
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
  LegalPolicyResponse,
  LegalSettings,
  PrivacyConsentStatus,
  PaymentMethod,
  ReferralSummaryResponse,
  RewardWalletSummary,
  ReferralProgramConfig,
  ReferralConfigTemplate,
  ReferralAttributionItem,
  ReviewProgramConfig,
  ReviewMetrics,
  ReviewPendingResponse,
  ReviewFeedbackItem,
  StripeAvailability,
  PlatformBrandSummary,
  PlatformLocationSummary,
  PlatformConfigData,
  PlatformBrandConfigRecord,
  PlatformLocationConfigRecord,
  PlatformBrandAdminsOverview,
  OperationSuccessResponse,
  ReferralCodeResponse,
  ReferralCodeResolution,
  StripeCheckoutResponse,
  StripeSessionResponse,
  AdminStripeConfig,
  AdminStripeToggleResponse,
  StripeOnboardingResponse,
  AdminDashboardSummary,
  AdminCalendarResponse,
  AdminSearchAppointmentsResponse,
} from './types';
import { getStoredLocalId, getTenantSubdomainOverride } from '@/lib/tenant';
import { buildAuthHeaders } from '@/lib/authToken';
import { ApiRequestError } from '@/lib/networkErrors';
import {
  API_BASE,
  AUTH_SESSION_ERROR_EVENT,
  DEFAULT_API_TIMEOUT_MS,
  apiRequest,
  buildApiUrl,
} from './api/request';

// Users API
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
export const getUserById = async (id: string): Promise<User | undefined> => apiRequest(`/users/${id}`);
export const getUserByEmail = async (email: string): Promise<User | undefined> =>
  apiRequest(`/users/by-email`, { query: { email }, skip404: true });
export const getUserByFirebaseUid = async (firebaseUid: string): Promise<User | undefined> =>
  apiRequest(`/users/by-firebase/${firebaseUid}`, { skip404: true });
export const createUser = async (data: Omit<User, 'id'> & { id?: string }): Promise<User> =>
  apiRequest('/users', { method: 'POST', body: data });
export const updateUser = async (id: string, data: Partial<User>): Promise<User> =>
  apiRequest(`/users/${id}`, { method: 'PATCH', body: data });
export const updateUserBlockStatus = async (id: string, blocked: boolean): Promise<User> =>
  apiRequest(`/users/${id}/block`, { method: 'PATCH', body: { blocked } });
export const deleteUser = async (id: string): Promise<void> =>
  apiRequest(`/users/${id}`, { method: 'DELETE' });

// Client Notes API
export const getClientNotes = async (userId: string): Promise<ClientNote[]> =>
  apiRequest('/client-notes', { query: { userId } });
export const createClientNote = async (data: { userId: string; content: string }): Promise<ClientNote> =>
  apiRequest('/client-notes', { method: 'POST', body: data });
export const updateClientNote = async (id: string, data: { content: string }): Promise<ClientNote> =>
  apiRequest(`/client-notes/${id}`, { method: 'PATCH', body: data });
export const deleteClientNote = async (id: string): Promise<void> =>
  apiRequest(`/client-notes/${id}`, { method: 'DELETE' });

// Tenant API
export const getTenantBootstrap = async (): Promise<TenantBootstrap> =>
  apiRequest('/tenant/bootstrap');

// Barbers API
export const getBarbers = async (options?: { serviceId?: string }): Promise<Barber[]> =>
  apiRequest('/barbers', { query: { serviceId: options?.serviceId } });
export const getBarberById = async (id: string): Promise<Barber | undefined> => apiRequest(`/barbers/${id}`);
export const createBarber = async (data: Omit<Barber, 'id'>): Promise<Barber> =>
  apiRequest('/barbers', { method: 'POST', body: data });
export const updateBarber = async (id: string, data: Partial<Barber>): Promise<Barber> =>
  apiRequest(`/barbers/${id}`, { method: 'PATCH', body: data });
export const updateBarberServiceAssignment = async (
  id: string,
  data: { serviceIds?: string[]; categoryIds?: string[] },
): Promise<Barber> => apiRequest(`/barbers/${id}/service-assignment`, { method: 'PATCH', body: data });
export const deleteBarber = async (id: string): Promise<void> =>
  apiRequest(`/barbers/${id}`, { method: 'DELETE' });

export const getBarberSchedule = async (barberId: string): Promise<ShopSchedule> =>
  apiRequest(`/schedules/barbers/${barberId}`);
export const updateBarberSchedule = async (barberId: string, schedule: ShopSchedule): Promise<ShopSchedule> =>
  apiRequest(`/schedules/barbers/${barberId}`, { method: 'PUT', body: { schedule } });

// Services API
export const getServices = async (options?: { includeArchived?: boolean }): Promise<Service[]> =>
  apiRequest('/services', { query: { includeArchived: options?.includeArchived ? 'true' : undefined } });
export const getServiceById = async (id: string): Promise<Service | undefined> => apiRequest(`/services/${id}`);
export const createService = async (data: Omit<Service, 'id'>): Promise<Service> =>
  apiRequest('/services', { method: 'POST', body: data });
export const updateService = async (id: string, data: Partial<Service>): Promise<Service> =>
  apiRequest(`/services/${id}`, { method: 'PATCH', body: data });
export const deleteService = async (id: string): Promise<void> =>
  apiRequest(`/services/${id}`, { method: 'DELETE' });

// Offers API
export const getOffers = async (target?: OfferTarget): Promise<Offer[]> =>
  apiRequest('/offers', { query: target ? { target } : undefined });
export const getActiveOffers = async (target?: OfferTarget): Promise<Offer[]> =>
  apiRequest('/offers/active', { query: target ? { target } : undefined });
export const createOffer = async (data: Omit<Offer, 'id' | 'categories' | 'services' | 'productCategories' | 'products'> & {
  categoryIds?: string[];
  serviceIds?: string[];
  productCategoryIds?: string[];
  productIds?: string[];
}): Promise<Offer> => apiRequest('/offers', { method: 'POST', body: data });
export const updateOffer = async (
  id: string,
  data: Partial<Omit<Offer, 'id' | 'categories' | 'services' | 'productCategories' | 'products'>> & {
    categoryIds?: string[];
    serviceIds?: string[];
    productCategoryIds?: string[];
    productIds?: string[];
  },
): Promise<Offer> => apiRequest(`/offers/${id}`, { method: 'PATCH', body: data });
export const deleteOffer = async (id: string): Promise<void> => apiRequest(`/offers/${id}`, { method: 'DELETE' });

// Loyalty API
export const getLoyaltyPrograms = async (): Promise<LoyaltyProgram[]> => apiRequest('/loyalty/programs');
export const getActiveLoyaltyPrograms = async (): Promise<LoyaltyProgram[]> => apiRequest('/loyalty/programs/active');
export const createLoyaltyProgram = async (data: CreateLoyaltyProgramPayload): Promise<LoyaltyProgram> =>
  apiRequest('/loyalty/programs', { method: 'POST', body: data });
export const updateLoyaltyProgram = async (id: string, data: Partial<CreateLoyaltyProgramPayload>): Promise<LoyaltyProgram> =>
  apiRequest(`/loyalty/programs/${id}`, { method: 'PATCH', body: data });
export const deleteLoyaltyProgram = async (id: string): Promise<void> =>
  apiRequest(`/loyalty/programs/${id}`, { method: 'DELETE' });
export const getLoyaltySummary = async (userId: string): Promise<LoyaltySummary> =>
  apiRequest('/loyalty/summary', { query: { userId } });
export const getLoyaltyPreview = async (userId: string, serviceId: string): Promise<LoyaltyPreview> =>
  apiRequest('/loyalty/preview', { query: { userId, serviceId } });

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

// Product Categories API
export const getProductCategories = async (withProducts = true): Promise<ProductCategory[]> =>
  apiRequest('/product-categories', { query: { withProducts } });
export const createProductCategory = async (
  data: Omit<ProductCategory, 'id' | 'products'>,
): Promise<ProductCategory> =>
  apiRequest('/product-categories', { method: 'POST', body: data });
export const updateProductCategory = async (
  id: string,
  data: Partial<Omit<ProductCategory, 'id' | 'products'>>,
): Promise<ProductCategory> => apiRequest(`/product-categories/${id}`, { method: 'PATCH', body: data });
export const deleteProductCategory = async (id: string): Promise<void> =>
  apiRequest(`/product-categories/${id}`, { method: 'DELETE' });

// Products API
export const getProducts = async (context: 'booking' | 'landing' = 'booking'): Promise<Product[]> =>
  apiRequest('/products', { query: { context } });
export const getAdminProducts = async (): Promise<Product[]> => apiRequest('/products/admin');
export const createProduct = async (data: Partial<Product>): Promise<Product> =>
  apiRequest('/products', { method: 'POST', body: data });
export const updateProduct = async (id: string, data: Partial<Product>): Promise<Product> =>
  apiRequest(`/products/${id}`, { method: 'PATCH', body: data });
export const deleteProduct = async (id: string): Promise<void> =>
  apiRequest(`/products/${id}`, { method: 'DELETE' });
export const importProducts = async (data: { sourceLocalId: string; targetLocalId?: string }): Promise<{ created: number; updated: number }> =>
  apiRequest('/products/import', { method: 'POST', body: data });

// Appointments API
export const getAppointmentsByDateRange = async (dateFrom: string, dateTo: string): Promise<Appointment[]> =>
  collectAppointmentPages((page, pageSize) =>
    getAppointmentsPage({ dateFrom, dateTo, page, pageSize, sort: 'asc' }),
  );
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

export const getAppointmentById = async (id: string): Promise<Appointment | undefined> => apiRequest(`/appointments/${id}`);
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

// Cash Register API
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

// Legal public API
export const getPrivacyPolicy = async (): Promise<LegalPolicyResponse> => apiRequest('/legal/privacy');
export const getCookiePolicy = async (): Promise<LegalPolicyResponse> => apiRequest('/legal/cookies');
export const getLegalNotice = async (): Promise<LegalPolicyResponse> => apiRequest('/legal/notice');
export const getPrivacyConsentStatus = async (userId: string): Promise<PrivacyConsentStatus> =>
  apiRequest('/legal/privacy/consent-status', { query: { userId } });

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
}): Promise<AiChatResponse> =>
  apiRequest('/admin/ai-assistant/chat', {
    method: 'POST',
    body: { message: payload.message, sessionId: payload.sessionId || undefined },
  });

export const getAiAssistantSession = async (payload: {
  sessionId: string;
}): Promise<AiChatSessionResponse> =>
  apiRequest(`/admin/ai-assistant/session/${payload.sessionId}`);

export const postAiAssistantTranscribe = async (payload: {
  file: File;
}): Promise<{ text: string }> => {
  const formData = new FormData();
  formData.append('file', payload.file);
  const url = buildApiUrl(`${API_BASE}/admin/ai-assistant/transcribe`);
  const authHeaders = await buildAuthHeaders();
  const controller = new AbortController();
  let timeoutTriggered = false;
  const timeoutId = window.setTimeout(() => {
    timeoutTriggered = true;
    controller.abort();
  }, DEFAULT_API_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        ...authHeaders,
        ...(getStoredLocalId() ? { 'x-local-id': getStoredLocalId() as string } : {}),
        ...(getTenantSubdomainOverride() ? { 'x-tenant-subdomain': getTenantSubdomainOverride() as string } : {}),
      },
      body: formData,
      signal: controller.signal,
    });
  } catch (error) {
    if (timeoutTriggered) {
      throw new ApiRequestError(
        'La transcripción tardó demasiado. Intenta con un audio más corto.',
        408,
        'TIMEOUT',
      );
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiRequestError('La transcripción fue cancelada.', 499, 'ABORTED');
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new ApiRequestError('Sin conexión a internet. Verifica tu red e intenta de nuevo.', 0, 'OFFLINE');
    }
    throw new ApiRequestError(
      'No se pudo enviar el audio para transcripción. Intenta nuevamente.',
      0,
      'NETWORK',
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    if ((response.status === 401 || response.status === 403) && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(AUTH_SESSION_ERROR_EVENT, { detail: { status: response.status } }));
    }
    let message = await response.text();
    try {
      const parsed = JSON.parse(message) as { message?: string; error?: string };
      message = parsed.message || parsed.error || message;
    } catch {
      // Keep raw message when it's not JSON.
    }
    throw new ApiRequestError(
      message || `API request failed (${response.status})`,
      response.status,
      'HTTP',
    );
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json() as Promise<{ text: string }>;
  }

  return { text: '' };
};

// Platform Admin API

export const getPlatformBrands = async (): Promise<PlatformBrandSummary[]> =>
  apiRequest('/platform/brands');

export const getPlatformMetrics = async (windowDays = 7): Promise<PlatformUsageMetrics> =>
  apiRequest(`/platform/metrics?window=${windowDays}`);

export const refreshPlatformMetrics = async (windowDays = 7): Promise<PlatformUsageMetrics> =>
  apiRequest(`/platform/metrics/refresh?window=${windowDays}`, {
    method: 'POST',
  });

export const getPlatformBrand = async (brandId: string): Promise<PlatformBrandSummary> =>
  apiRequest(`/platform/brands/${brandId}`);

export const createPlatformBrand = async (
  data: { name: string; subdomain: string; customDomain?: string | null; isActive?: boolean },
): Promise<PlatformBrandSummary> =>
  apiRequest('/platform/brands', {
    method: 'POST',
    body: data,
  });

export const updatePlatformBrand = async (
  brandId: string,
  data: Partial<{ name: string; subdomain: string; customDomain?: string | null; isActive?: boolean; defaultLocationId?: string | null }>,
): Promise<PlatformBrandSummary> =>
  apiRequest(`/platform/brands/${brandId}`, {
    method: 'PATCH',
    body: data,
  });

export const deletePlatformBrand = async (brandId: string): Promise<void> =>
  apiRequest(`/platform/brands/${brandId}`, {
    method: 'DELETE',
  });

export const getPlatformLocations = async (brandId: string): Promise<PlatformLocationSummary[]> =>
  apiRequest(`/platform/brands/${brandId}/locations`);

export const createPlatformLocation = async (
  brandId: string,
  data: { name: string; slug?: string | null; isActive?: boolean },
): Promise<PlatformLocationSummary> =>
  apiRequest(`/platform/brands/${brandId}/locations`, {
    method: 'POST',
    body: data,
  });

export const updatePlatformLocation = async (
  localId: string,
  data: Partial<{ name: string; slug?: string | null; isActive?: boolean }>,
): Promise<PlatformLocationSummary> =>
  apiRequest(`/platform/locations/${localId}`, {
    method: 'PATCH',
    body: data,
  });

export const deletePlatformLocation = async (localId: string): Promise<void> =>
  apiRequest(`/platform/locations/${localId}`, {
    method: 'DELETE',
  });

export const getPlatformBrandConfig = async (brandId: string): Promise<PlatformConfigData> =>
  apiRequest(`/platform/brands/${brandId}/config`);

export const updatePlatformBrandConfig = async (
  brandId: string,
  data: Record<string, unknown>,
): Promise<PlatformBrandConfigRecord> =>
  apiRequest(`/platform/brands/${brandId}/config`, {
    method: 'PATCH',
    body: { data },
  });

export const getPlatformLocationConfig = async (localId: string): Promise<PlatformConfigData> =>
  apiRequest(`/platform/locations/${localId}/config`);

export const updatePlatformLocationConfig = async (
  localId: string,
  data: Record<string, unknown>,
): Promise<PlatformLocationConfigRecord> =>
  apiRequest(`/platform/locations/${localId}/config`, {
    method: 'PATCH',
    body: { data },
  });

export const connectPlatformStripeBrand = async (brandId: string): Promise<StripeOnboardingResponse> =>
  apiRequest(`/platform/payments/stripe/brand/${brandId}/connect`, {
    method: 'POST',
  });

export const connectPlatformStripeLocation = async (localId: string): Promise<StripeOnboardingResponse> =>
  apiRequest(`/platform/payments/stripe/location/${localId}/connect`, {
    method: 'POST',
  });

export const getPlatformBrandLegalSettings = async (brandId: string): Promise<LegalSettings> =>
  apiRequest(`/platform/brands/${brandId}/legal/settings`);

export const updatePlatformBrandLegalSettings = async (
  brandId: string,
  data: Partial<LegalSettings>,
): Promise<LegalSettings> =>
  apiRequest(`/platform/brands/${brandId}/legal/settings`, {
    method: 'PUT',
    body: data,
  });

export const getPlatformBrandDpa = async (brandId: string): Promise<LegalPolicyResponse> =>
  apiRequest(`/platform/brands/${brandId}/legal/dpa`);

export const getPlatformBrandAdmins = async (brandId: string): Promise<PlatformBrandAdminsOverview> =>
  apiRequest(`/platform/brands/${brandId}/admins`);

export const assignPlatformBrandAdmin = async (
  brandId: string,
  data: { email: string; localId?: string; applyToAll?: boolean; adminRoleId?: string | null },
): Promise<OperationSuccessResponse> =>
  apiRequest(`/platform/brands/${brandId}/admins`, {
    method: 'POST',
    body: data,
  });

export const removePlatformBrandAdmin = async (
  brandId: string,
  data: { userId?: string; email?: string; localId?: string; removeFromAll?: boolean },
): Promise<OperationSuccessResponse> =>
  apiRequest(`/platform/brands/${brandId}/admins`, {
    method: 'DELETE',
    body: data,
  });

// Referrals & Rewards API
export const getReferralSummary = async (userId: string): Promise<ReferralSummaryResponse> =>
  apiRequest('/referrals/my-summary', { query: { userId } });

export const getReferralCode = async (userId: string): Promise<ReferralCodeResponse> =>
  apiRequest('/referrals/my-code', { query: { userId } });

export const resolveReferralCode = async (code: string): Promise<ReferralCodeResolution> =>
  apiRequest(`/referrals/resolve/${code}`);

export const attributeReferral = async (data: {
  code: string;
  channel: 'whatsapp' | 'qr' | 'copy' | 'link';
  userId?: string;
  referredPhone?: string;
  referredEmail?: string;
}): Promise<{ attributionId: string; expiresAt: string }> =>
  apiRequest('/referrals/attribute', { method: 'POST', body: data });

export const getRewardsWallet = async (userId: string): Promise<RewardWalletSummary> =>
  apiRequest('/rewards/wallet', { query: { userId } });

export const getReferralConfig = async (): Promise<ReferralProgramConfig> =>
  apiRequest('/admin/referrals/config');

export const updateReferralConfig = async (data: Partial<ReferralProgramConfig>): Promise<ReferralProgramConfig> =>
  apiRequest('/admin/referrals/config', { method: 'PUT', body: data });

export const copyReferralConfig = async (sourceLocationId: string): Promise<ReferralProgramConfig> =>
  apiRequest('/admin/referrals/config/copy-from', { method: 'POST', body: { sourceLocationId } });

export const applyReferralTemplate = async (templateId: string): Promise<ReferralProgramConfig> =>
  apiRequest('/admin/referrals/config/apply-template', { method: 'POST', body: { templateId } });

export const getReferralTemplatesForLocal = async (): Promise<ReferralConfigTemplate[]> =>
  apiRequest('/admin/referrals/templates');

export const getReferralOverview = async (params?: { from?: string; to?: string }) =>
  apiRequest('/admin/referrals/overview', { query: params });

export const getReferralList = async (params?: {
  status?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ total: number; items: ReferralAttributionItem[] }> =>
  apiRequest('/admin/referrals/list', { query: params });

export const voidReferral = async (id: string, reason?: string) =>
  apiRequest(`/admin/referrals/void/${id}`, { method: 'POST', body: { reason } });

// Reviews API
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

// Stripe Payments (public)
export const getStripeAvailability = async (): Promise<StripeAvailability> =>
  apiRequest('/payments/stripe/availability');
export const createStripeCheckout = async (data: CreateAppointmentPayload): Promise<StripeCheckoutResponse> =>
  apiRequest('/payments/stripe/checkout', { method: 'POST', body: data });
export const getStripeSession = async (sessionId: string): Promise<StripeSessionResponse> =>
  apiRequest(`/payments/stripe/session/${sessionId}`);

// Stripe Payments (admin local)
export const getAdminStripeConfig = async (): Promise<AdminStripeConfig> =>
  apiRequest('/admin/payments/stripe/config');
export const updateAdminStripeConfig = async (enabled: boolean): Promise<AdminStripeToggleResponse> =>
  apiRequest('/admin/payments/stripe/config', { method: 'PUT', body: { enabled } });
export const createAdminStripeConnect = async (): Promise<StripeOnboardingResponse> =>
  apiRequest('/admin/payments/stripe/connect', { method: 'POST' });
