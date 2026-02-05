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
      logoLightUrl?: string;
      logoLightFileId?: string;
      logoDarkUrl?: string;
      logoDarkFileId?: string;
      heroBackgroundUrl?: string;
      heroBackgroundFileId?: string;
      heroBackgroundDimmed?: boolean;
      heroBackgroundOpacity?: number;
      heroBadgeEnabled?: boolean;
      heroImageUrl?: string;
      heroImageFileId?: string;
      heroImage2Url?: string;
      heroImage2FileId?: string;
      heroImage3Url?: string;
      heroImage3FileId?: string;
      heroImage4Url?: string;
      heroImage4FileId?: string;
      heroImage5Url?: string;
      heroImage5FileId?: string;
      heroImageEnabled?: boolean;
      heroTextColor?: 'auto' | 'white' | 'black' | 'gray-dark' | 'gray-light';
      heroLocationCardEnabled?: boolean;
      heroImagePosition?: 'left' | 'right';
      heroNoImageAlign?: 'center' | 'right' | 'left';
      signImageUrl?: string;
      signImageFileId?: string;
    } | null;
    adminSidebar?: {
      hiddenSections?: string[];
    } | null;
    theme?: {
      primary?: string;
      mode?: 'dark' | 'light';
    } | null;
    notificationPrefs?: {
      email?: boolean;
      whatsapp?: boolean;
      sms?: boolean;
    } | null;
    features?: {
      barberServiceAssignmentEnabled?: boolean;
    } | null;
    landing?: {
      order?: string[];
      hiddenSections?: string[];
      presentation?: {
        sections?: Array<{
          enabled?: boolean;
          imageUrl?: string;
          imageFileId?: string;
          title?: string;
          body?: string;
          imagePosition?: 'left' | 'right';
        }>;
      };
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
  assignedServiceIds?: string[];
  assignedCategoryIds?: string[];
  hasAnyServiceAssignment?: boolean;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  finalPrice?: number;
  duration: number; // Minutes
  isArchived?: boolean;
  categoryId?: string | null;
  category?: ServiceCategory | null;
  appliedOffer?: AppliedOffer | null;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  sku?: string | null;
  price: number;
  finalPrice?: number;
  stock: number;
  minStock?: number;
  imageUrl?: string | null;
  imageFileId?: string | null;
  isActive: boolean;
  isPublic: boolean;
  categoryId?: string | null;
  category?: ProductCategory | null;
  appliedOffer?: AppliedOffer | null;
}

export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';
export type PaymentMethod = 'cash' | 'card' | 'bizum' | 'stripe';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'cancelled' | 'exempt' | 'in_person';
export type CashMovementType = 'in' | 'out';
export type CashMovementProductOperationType = 'purchase' | 'sale';

export interface AppointmentProductItem {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  imageUrl?: string | null;
  isPublic?: boolean;
}

export interface Appointment {
  id: string;
  userId: string | null;
  barberId: string;
  barberNameSnapshot?: string | null;
  serviceId: string;
  serviceNameSnapshot?: string | null;
  loyaltyProgramId?: string | null;
  loyaltyRewardApplied?: boolean;
  referralAttributionId?: string | null;
  appliedCouponId?: string | null;
  walletAppliedAmount?: number;
  startDateTime: string; // ISO string
  price: number;
  paymentMethod?: PaymentMethod | null;
  paymentStatus?: PaymentStatus | null;
  paymentAmount?: number | null;
  paymentCurrency?: string | null;
  paymentPaidAt?: string | null;
  paymentExpiresAt?: string | null;
  status: AppointmentStatus;
  notes?: string;
  guestName?: string;
  guestContact?: string;
  products?: AppointmentProductItem[];
}

export interface StripeAvailability {
  enabled: boolean;
  mode?: 'brand' | 'location';
  reason?: string;
  publishableKey?: string | null;
}

export interface CashMovement {
  id: string;
  localId: string;
  type: CashMovementType;
  amount: number;
  method?: PaymentMethod | null;
  note?: string | null;
  productOperationType?: CashMovementProductOperationType | null;
  productItems?: Array<{
    id: string;
    productId?: string | null;
    productName: string;
    productNameSnapshot: string;
    quantity: number;
    unitAmount: number;
    totalAmount: number;
  }>;
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

export type DayKey =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

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

export interface BreakRange {
  start: string;
  end: string;
}

export interface ShopSchedule {
  bufferMinutes?: number;
  endOverflowMinutes?: number;
  breaks?: Record<DayKey, BreakRange[]>;
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
  visibility: {
    experienceYears: boolean;
    averageRating: boolean;
    yearlyBookings: boolean;
    repeatClientsPercentage: boolean;
  };
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

export interface ProductCategory {
  id: string;
  name: string;
  description?: string;
  position?: number;
  products?: Product[];
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
    barberServiceAssignmentEnabled: boolean;
  };
  products: {
    enabled: boolean;
    categoriesEnabled: boolean;
    clientPurchaseEnabled: boolean;
    showOnLanding: boolean;
  };
  adminSidebar?: {
    order?: AdminSectionKey[];
  };
  qrSticker: QrSticker | null;
}

export type DiscountType = 'percentage' | 'amount';
export type OfferScope = 'all' | 'categories' | 'services' | 'products';
export type OfferTarget = 'service' | 'product';

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
  target?: OfferTarget;
  startDate?: string | null;
  endDate?: string | null;
  active: boolean;
  categories: ServiceCategory[];
  services: Service[];
  productCategories?: ProductCategory[];
  products?: Product[];
}

export type RewardType = 'WALLET' | 'PERCENT_DISCOUNT' | 'FIXED_DISCOUNT' | 'FREE_SERVICE';
export type RewardTxType = 'CREDIT' | 'DEBIT' | 'HOLD' | 'RELEASE' | 'COUPON_ISSUED' | 'COUPON_USED' | 'ADJUSTMENT';
export type RewardTxStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';
export type ReferralAttributionStatus = 'ATTRIBUTED' | 'BOOKED' | 'COMPLETED' | 'REWARDED' | 'VOIDED' | 'EXPIRED';
export type ReviewRequestStatus =
  | 'PENDING'
  | 'ELIGIBLE'
  | 'SHOWN'
  | 'RATED'
  | 'CLICKED'
  | 'COMPLETED'
  | 'DISMISSED'
  | 'EXPIRED';
export type ReviewFeedbackStatus = 'OPEN' | 'RESOLVED';

export interface ReferralRewardSummaryItem {
  type: RewardType;
  value?: number | null;
  serviceId?: string | null;
  text: string;
}

export interface ReferralRewardSummary {
  referrer: ReferralRewardSummaryItem;
  referred: ReferralRewardSummaryItem;
}

export interface ReferralProgramConfig {
  id: string | null;
  localId: string;
  enabled: boolean;
  attributionExpiryDays: number;
  newCustomerOnly: boolean;
  monthlyMaxRewardsPerReferrer?: number | null;
  allowedServiceIds?: string[] | null;
  rewardReferrerType: RewardType;
  rewardReferrerValue?: number | null;
  rewardReferrerServiceId?: string | null;
  rewardReferrerServiceName?: string | null;
  rewardReferredType: RewardType;
  rewardReferredValue?: number | null;
  rewardReferredServiceId?: string | null;
  rewardReferredServiceName?: string | null;
  antiFraud: {
    blockSelfByUser: boolean;
    blockSelfByContact: boolean;
    blockDuplicateContact: boolean;
  };
  appliedTemplateId?: string | null;
}

export interface ReferralConfigTemplate {
  id: string;
  brandId: string;
  name: string;
  enabled: boolean;
  attributionExpiryDays: number;
  newCustomerOnly: boolean;
  monthlyMaxRewardsPerReferrer?: number | null;
  allowedServiceIds?: string[] | null;
  rewardReferrerType: RewardType;
  rewardReferrerValue?: number | null;
  rewardReferrerServiceId?: string | null;
  rewardReferredType: RewardType;
  rewardReferredValue?: number | null;
  rewardReferredServiceId?: string | null;
  antiFraud?: {
    blockSelfByUser: boolean;
    blockSelfByContact: boolean;
    blockDuplicateContact: boolean;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface ReferralAttributionItem {
  id: string;
  status: ReferralAttributionStatus;
  attributedAt: string;
  expiresAt: string;
  referrer?: {
    id?: string;
    name?: string;
    email?: string;
    phone?: string | null;
  } | null;
  referred?: {
    id?: string | null;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  firstAppointment?: {
    id: string;
    startDateTime: string;
    status: AppointmentStatus;
    price: number;
  } | null;
}

export interface ReferralSummaryResponse {
  code: string;
  programEnabled?: boolean;
  shareUrl?: string | null;
  qrUrlPayload?: string | null;
  rewardSummary: ReferralRewardSummary;
  pending: ReferralAttributionItem[];
  confirmed: ReferralAttributionItem[];
  expired: ReferralAttributionItem[];
  invalidated: ReferralAttributionItem[];
}

export interface ReviewCopy {
  title: string;
  subtitle: string;
  positiveText: string;
  positiveCta: string;
  negativeText: string;
  negativeCta: string;
  snoozeCta: string;
}

export interface ReviewProgramConfig {
  id: string | null;
  localId: string;
  enabled: boolean;
  googleReviewUrl?: string | null;
  cooldownDays: number;
  minVisitsToAsk: number;
  showDelayMinutes: number;
  maxSnoozes: number;
  snoozeHours: number;
  copyJson: ReviewCopy;
}

export interface ReviewPendingResponse {
  id: string;
  status: ReviewRequestStatus;
  rating?: number | null;
  eligibleAt: string;
  snoozeCount: number;
  copy: ReviewCopy;
  googleReviewUrl: string;
}

export interface ReviewMetrics {
  createdCount: number;
  shownCount: number;
  ratedCount: number;
  googleClicksCount: number;
  feedbackCount: number;
  conversionRate: number;
}

export interface ReviewFeedbackItem {
  id: string;
  rating?: number | null;
  privateFeedback?: string | null;
  feedbackStatus: ReviewFeedbackStatus;
  status: ReviewRequestStatus;
  createdAt: string;
  appointmentId: string;
  appointmentDate?: string | null;
  serviceName?: string | null;
  barberName?: string | null;
  clientName?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  guestContact?: string | null;
}

export interface RewardWalletSummary {
  wallet: {
    balance: number;
    availableBalance: number;
    pendingHolds: number;
  };
  transactions: Array<{
    id: string;
    type: RewardTxType;
    status: RewardTxStatus;
    amount: number | null;
    description: string;
    createdAt: string;
  }>;
  coupons: Coupon[];
}

export interface Coupon {
  id: string;
  code?: string | null;
  discountType: RewardType;
  discountValue?: number | null;
  serviceId?: string | null;
  isActive: boolean;
  maxUses: number;
  usedCount: number;
  validFrom?: string | null;
  validTo?: string | null;
  createdAt?: string;
}

export type LoyaltyScope = 'global' | 'service' | 'category';

export interface LoyaltyProgram {
  id: string;
  name: string;
  description?: string | null;
  scope: LoyaltyScope;
  requiredVisits: number;
  maxCyclesPerClient?: number | null;
  priority: number;
  isActive: boolean;
  serviceId?: string | null;
  serviceName?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface LoyaltyProgramProgress {
  totalVisits: number;
  totalVisitsAccumulated: number;
  cycleVisits: number;
  nextFreeIn: number;
  isRewardNext: boolean;
}

export interface LoyaltyRewardHistoryItem {
  appointmentId: string;
  serviceId: string;
  serviceName?: string | null;
  startDateTime: string;
  status: AppointmentStatus;
  price: number;
}

export interface LoyaltySummary {
  enabled: boolean;
  programs: Array<{
    program: LoyaltyProgram;
    progress: LoyaltyProgramProgress;
    rewards: LoyaltyRewardHistoryItem[];
  }>;
}

export interface LoyaltyPreview {
  enabled: boolean;
  program: LoyaltyProgram | null;
  progress: LoyaltyProgramProgress | null;
  isFreeNext: boolean;
  nextIndex: number | null;
}

export interface CreateLoyaltyProgramPayload {
  name: string;
  description?: string | null;
  scope: LoyaltyScope;
  requiredVisits: number;
  maxCyclesPerClient?: number | null;
  priority?: number;
  isActive?: boolean;
  serviceId?: string | null;
  categoryId?: string | null;
}

export type AdminSectionKey =
  | 'dashboard'
  | 'calendar'
  | 'search'
  | 'offers'
  | 'cash-register'
  | 'stock'
  | 'clients'
  | 'services'
  | 'barbers'
  | 'loyalty'
  | 'referrals'
  | 'reviews'
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
  referralAttributionId?: string;
  appliedCouponId?: string;
  useWallet?: boolean;
  products?: Array<{ productId: string; quantity: number }>;
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
