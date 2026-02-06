export const queryKeys = {
  siteSettings: (localId: string | null | undefined) => ["site-settings", localId || "default"] as const,
  adminDashboard: (
    localId: string | null | undefined,
    windowDays: number,
    barberId?: string | null,
  ) => ["admin-dashboard", localId || "default", windowDays, barberId || "all"] as const,
  bookingBootstrap: (localId: string | null | undefined) =>
    ["booking-bootstrap", localId || "default"] as const,
  bookingLoyaltyPreview: (
    localId: string | null | undefined,
    userId: string | null | undefined,
    serviceId: string | null | undefined,
  ) => ["booking-loyalty-preview", localId || "default", userId || "anonymous", serviceId || "none"] as const,
  rewardsWallet: (localId: string | null | undefined, userId: string | null | undefined) =>
    ["rewards-wallet", localId || "default", userId || "anonymous"] as const,
  privacyConsentStatus: (localId: string | null | undefined, userId: string | null | undefined) =>
    ["privacy-consent-status", localId || "default", userId || "anonymous"] as const,
  bookingSlots: (
    localId: string | null | undefined,
    serviceId: string | null | undefined,
    date: string,
    mode: "single" | "auto",
    barberId: string | null | undefined,
    barberIdsKey: string,
  ) =>
    [
      "booking-slots",
      localId || "default",
      serviceId || "none",
      date,
      mode,
      barberId || "none",
      barberIdsKey || "none",
    ] as const,
  bookingWeeklyLoad: (
    localId: string | null | undefined,
    serviceId: string | null | undefined,
    dateFrom: string,
    dateTo: string,
    barberIdsKey: string,
  ) =>
    [
      "booking-weekly-load",
      localId || "default",
      serviceId || "none",
      dateFrom,
      dateTo,
      barberIdsKey || "none",
    ] as const,
  clientAppointments: (localId: string | null | undefined, userId: string | null | undefined) =>
    ["client-appointments", localId || "default", userId || "anonymous"] as const,
  clientLoyaltySummary: (localId: string | null | undefined, userId: string | null | undefined) =>
    ["client-loyalty-summary", localId || "default", userId || "anonymous"] as const,
  clientReferralSummary: (localId: string | null | undefined, userId: string | null | undefined) =>
    ["client-referral-summary", localId || "default", userId || "anonymous"] as const,
  appointmentsRange: (
    localId: string | null | undefined,
    dateFrom: string,
    dateTo: string,
  ) => ["appointments", localId || "default", "range", dateFrom, dateTo] as const,
  adminCalendar: (
    localId: string | null | undefined,
    dateFrom: string,
    dateTo: string,
    sort: "asc" | "desc" = "asc",
  ) => ["appointments", localId || "default", "admin-calendar", dateFrom, dateTo, sort] as const,
  adminSearchAppointments: (
    localId: string | null | undefined,
    page: number,
    pageSize: number,
    barberId?: string | null,
    date?: string | null,
    sort: "asc" | "desc" = "desc",
  ) =>
    [
      "appointments",
      localId || "default",
      "admin-search",
      page,
      pageSize,
      barberId || "all",
      date || "all",
      sort,
    ] as const,
  usersByIds: (localId: string | null | undefined, ids: string[]) =>
    ["users", localId || "default", "ids", ids.join(",")] as const,
  services: (
    localId: string | null | undefined,
    includeArchived = false,
  ) => ["services", localId || "default", includeArchived ? "all" : "active"] as const,
  offers: (localId: string | null | undefined, target: "service" | "product") =>
    ["offers", localId || "default", target] as const,
  loyaltyPrograms: (localId: string | null | undefined) =>
    ["loyalty-programs", localId || "default"] as const,
  barbers: (localId: string | null | undefined, serviceId?: string) =>
    ["barbers", localId || "default", serviceId || "all"] as const,
  serviceCategories: (localId: string | null | undefined, withServices = true) =>
    ["service-categories", localId || "default", withServices ? "with-services" : "plain"] as const,
  products: (
    localId: string | null | undefined,
    context: "booking" | "landing" = "booking",
  ) => ["products", localId || "default", context] as const,
  adminProducts: (localId: string | null | undefined) =>
    ["products-admin", localId || "default"] as const,
  cashRegister: (
    localId: string | null | undefined,
    date: string,
    productsEnabled: boolean,
  ) => ["cash-register", localId || "default", date, productsEnabled ? "products" : "no-products"] as const,
  adminStripeConfig: (localId: string | null | undefined) =>
    ["admin-stripe-config", localId || "default"] as const,
  adminRoles: (localId: string | null | undefined) =>
    ["admin-roles", localId || "default"] as const,
  adminRoleUsers: (localId: string | null | undefined) =>
    ["users", localId || "default", "admin-roles", "admins"] as const,
  adminRoleSearch: (localId: string | null | undefined, query: string) =>
    ["users", localId || "default", "admin-roles", "search", query || "empty"] as const,
  adminClients: (
    localId: string | null | undefined,
    page: number,
    pageSize: number,
    query = "",
  ) => ["users", localId || "default", "admin-clients", page, pageSize, query || "empty"] as const,
  adminClientAppointments: (
    localId: string | null | undefined,
    userId: string | null | undefined,
    page: number,
    pageSize: number,
    sort: "asc" | "desc" = "desc",
  ) =>
    [
      "appointments",
      localId || "default",
      "admin-clients",
      userId || "none",
      page,
      pageSize,
      sort,
    ] as const,
  adminClientNotes: (localId: string | null | undefined, userId: string | null | undefined) =>
    ["client-notes", localId || "default", userId || "none"] as const,
  adminReferralConfig: (localId: string | null | undefined) =>
    ["referrals", localId || "default", "config"] as const,
  adminReferralOverview: (localId: string | null | undefined) =>
    ["referrals", localId || "default", "overview"] as const,
  adminReferralList: (
    localId: string | null | undefined,
    status: string,
    query: string,
    page: number,
    pageSize: number,
  ) =>
    [
      "referrals",
      localId || "default",
      "list",
      status || "all",
      query || "empty",
      page,
      pageSize,
    ] as const,
  adminReviewConfig: (localId: string | null | undefined) =>
    ["reviews", localId || "default", "config"] as const,
  adminReviewMetrics: (localId: string | null | undefined, from: string, to: string) =>
    ["reviews", localId || "default", "metrics", from, to] as const,
  adminReviewFeedback: (
    localId: string | null | undefined,
    status: "OPEN" | "RESOLVED" | "ALL",
    page: number,
    pageSize: number,
  ) =>
    ["reviews", localId || "default", "feedback", status, page, pageSize] as const,
  adminAlerts: (localId: string | null | undefined) =>
    ["alerts", localId || "default"] as const,
  adminGeneralHolidays: (localId: string | null | undefined) =>
    ["holidays", localId || "default", "general"] as const,
  adminBarberHolidays: (localId: string | null | undefined, barberId: string | null | undefined) =>
    ["holidays", localId || "default", "barber", barberId || "none"] as const,
  shopSchedule: (localId: string | null | undefined) =>
    ["shop-schedule", localId || "default"] as const,
  productCategories: (localId: string | null | undefined, withProducts = true) =>
    ["product-categories", localId || "default", withProducts ? "with-products" : "plain"] as const,
  platformBrands: () => ["platform-brands"] as const,
  platformBrand: (brandId: string | null | undefined) =>
    ["platform-brand", brandId || "none"] as const,
  platformBrandConfig: (brandId: string | null | undefined) =>
    ["platform-brand-config", brandId || "none"] as const,
  platformBrandAdmins: (brandId: string | null | undefined) =>
    ["platform-brand-admins", brandId || "none"] as const,
  platformBrandLegal: (brandId: string | null | undefined) =>
    ["platform-brand-legal", brandId || "none"] as const,
  platformBrandDpa: (brandId: string | null | undefined) =>
    ["platform-brand-dpa", brandId || "none"] as const,
  platformLocationConfig: (localId: string | null | undefined) =>
    ["platform-location-config", localId || "none"] as const,
  platformMetrics: (windowDays: number) => ["platform-metrics", windowDays] as const,
};
