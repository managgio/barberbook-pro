export type UserRole = 'client' | 'admin';

export interface User {
  id: string;
  firebaseUid?: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  notificationPrefs: {
    email: boolean;
    whatsapp: boolean;
    sms?: boolean;
  };
  isBlocked?: boolean;
  prefersBarberSelection?: boolean;
  avatar?: string;
  isSuperAdmin?: boolean;
  isPlatformAdmin?: boolean;
  isLocalAdmin?: boolean;
  adminRoleId?: string | null;
}

export interface Brand {
  id: string;
  name: string;
  subdomain: string;
  customDomain?: string | null;
  defaultLocationId?: string | null;
  isActive?: boolean;
}

export interface Location {
  id: string;
  name: string;
  slug?: string | null;
  isActive?: boolean;
}

export interface FirebaseWebConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
}

export interface TenantBootstrap {
  brand: Brand | null;
  locations: Location[];
  currentLocalId: string;
  isPlatform?: boolean;
  config?: {
    branding?: {
      name?: string;
      shortName?: string;
      logoUrl?: string;
      logoFileId?: string;
      heroBackgroundUrl?: string;
      heroBackgroundFileId?: string;
      heroImageUrl?: string;
      heroImageFileId?: string;
      signImageUrl?: string;
      signImageFileId?: string;
    } | null;
    adminSidebar?: {
      hiddenSections?: string[];
    } | null;
    theme?: {
      primary?: string;
    } | null;
    notificationPrefs?: {
      email?: boolean;
      whatsapp?: boolean;
      sms?: boolean;
    } | null;
  };
}

export interface Barber {
  id: string;
  name: string;
  photo?: string | null;
  photoFileId?: string | null;
  specialty: string;
  role: 'worker' | 'admin';
  bio?: string;
  startDate: string;
  endDate?: string | null;
  isActive?: boolean;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  finalPrice?: number;
  duration: number; // Minutes
  categoryId?: string | null;
  category?: ServiceCategory | null;
  appliedOffer?: AppliedOffer | null;
}

export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';
export type PaymentMethod = 'cash' | 'card' | 'bizum';
export type CashMovementType = 'in' | 'out';

export interface Appointment {
  id: string;
  userId: string | null;
  barberId: string;
  serviceId: string;
  startDateTime: string; // ISO string
  price: number;
  paymentMethod?: PaymentMethod | null;
  status: AppointmentStatus;
  notes?: string;
  guestName?: string;
  guestContact?: string;
}

export interface CashMovement {
  id: string;
  localId: string;
  type: CashMovementType;
  amount: number;
  method?: PaymentMethod | null;
  note?: string | null;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClientNote {
  id: string;
  userId: string;
  localId: string;
  authorId?: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShiftSchedule {
  enabled: boolean;
  start: string; // "09:00"
  end: string; // "14:00"
}

export interface DaySchedule {
  closed: boolean;
  morning: ShiftSchedule;
  afternoon: ShiftSchedule;
}

export interface ShopSchedule {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

export interface Alert {
  id: string;
  title: string;
  message: string;
  active: boolean;
  type: 'info' | 'warning' | 'success';
  startDate?: string | null;
  endDate?: string | null;
}

export interface SiteStats {
  experienceStartYear: number;
  averageRating: number;
  yearlyBookings: number;
  repeatClientsPercentage: number;
}

export interface SocialLinks {
  instagram?: string;
  x?: string;
  tiktok?: string;
  youtube?: string;
  linkedin?: string;
}

export interface QrSticker {
  url: string;
  imageUrl: string;
  imageFileId: string;
  createdAt: string;
}

export interface ServiceCategory {
  id: string;
  name: string;
  description?: string;
  position?: number;
  services?: Service[];
}

export interface SiteSettings {
  branding: {
    name: string;
    shortName: string;
    tagline: string;
    description: string;
  };
  location: {
    label: string;
    mapUrl: string;
    mapEmbedUrl: string;
  };
  contact: {
    phone: string;
    email: string;
  };
  socials: SocialLinks;
  stats: SiteStats;
  openingHours: ShopSchedule;
  appointments: {
    cancellationCutoffHours: number;
  };
  services: {
    categoriesEnabled: boolean;
  };
  qrSticker: QrSticker | null;
}

export type DiscountType = 'percentage' | 'amount';
export type OfferScope = 'all' | 'categories' | 'services';

export interface AppliedOffer {
  id: string;
  name: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  scope: OfferScope;
  startDate?: string | null;
  endDate?: string | null;
  amountOff: number;
}

export interface Offer {
  id: string;
  name: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  scope: OfferScope;
  startDate?: string | null;
  endDate?: string | null;
  active: boolean;
  categories: ServiceCategory[];
  services: Service[];
}

export type AdminSectionKey =
  | 'dashboard'
  | 'calendar'
  | 'search'
  | 'cash-register'
  | 'clients'
  | 'services'
  | 'barbers'
  | 'alerts'
  | 'holidays'
  | 'roles'
  | 'settings'
  | 'legal'
  | 'audit';

export interface AdminRole {
  id: string;
  name: string;
  description?: string;
  permissions: AdminSectionKey[];
}

export interface BookingState {
  serviceId: string | null;
  barberId: string | null;
  dateTime: string | null;
  notes?: string;
}

export interface CreateAppointmentPayload {
  userId?: string | null;
  barberId: string;
  serviceId: string;
  startDateTime: string;
  status?: AppointmentStatus;
  notes?: string;
  guestName?: string;
  guestContact?: string;
  privacyConsentGiven?: boolean;
}

export interface LegalSection {
  heading: string;
  bodyMarkdown: string;
}

export interface LegalBusinessIdentity {
  ownerName: string;
  taxId?: string | null;
  address?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  country?: string | null;
}

export interface SubProcessor {
  name: string;
  purpose: string;
  country: string;
  dataTypes: string;
  link?: string | null;
}

export interface LegalAiDisclosure {
  title: string;
  bodyMarkdown: string;
  providerNames: string[];
}

export interface LegalPolicyResponse {
  title: string;
  effectiveDate: string;
  version: number;
  sections: LegalSection[];
  businessIdentity: LegalBusinessIdentity;
  subProcessors?: SubProcessor[];
  aiDisclosure?: LegalAiDisclosure | null;
}

export interface PrivacyConsentStatus {
  required: boolean;
  policyVersion: number;
}

export interface LegalCustomSections {
  privacy?: LegalSection[];
  cookies?: LegalSection[];
  notice?: LegalSection[];
  dpa?: LegalSection[];
}

export interface LegalSettings {
  legalOwnerName?: string | null;
  legalOwnerTaxId?: string | null;
  legalOwnerAddress?: string | null;
  legalContactEmail?: string | null;
  legalContactPhone?: string | null;
  country: string;
  privacyPolicyVersion: number;
  cookiePolicyVersion: number;
  legalNoticeVersion: number;
  aiDisclosureEnabled: boolean;
  aiProviderNames: string[];
  subProcessors: SubProcessor[];
  optionalCustomSections?: LegalCustomSections;
  retentionDays?: number | null;
}

export interface AuditLogActor {
  id: string;
  name: string;
  email: string;
}

export interface AuditLog {
  id: string;
  brandId: string;
  locationId?: string | null;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  actorUser?: AuditLogActor | null;
}

export interface HolidayRange {
  start: string;
  end: string;
}

export interface AiChatResponse {
  sessionId: string;
  assistantMessage: string;
  actions?: {
    appointmentsChanged?: boolean;
    holidaysChanged?: boolean;
    alertsChanged?: boolean;
  };
}

export interface AiChatSessionMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface AiChatSessionResponse {
  sessionId: string;
  summary: string;
  messages: AiChatSessionMessage[];
}

export interface PlatformUsageSeriesPoint {
  dateKey: string;
  costUsd: number;
  tokensInput: number;
  tokensOutput: number;
  tokensTotal: number;
  messagesCount: number;
  storageUsedBytes: number;
  storageLimitBytes: number;
}

export interface PlatformUsageMetrics {
  windowDays: number;
  range: { start: string; end: string };
  thresholds: {
    openaiDailyCostUsd: number | null;
    twilioDailyCostUsd: number | null;
    imagekitStorageBytes: number | null;
  };
  openai: { series: PlatformUsageSeriesPoint[] };
  twilio: { series: PlatformUsageSeriesPoint[] };
  imagekit: { series: PlatformUsageSeriesPoint[] };
}
