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
  };
  prefersBarberSelection?: boolean;
  avatar?: string;
  isSuperAdmin?: boolean;
  adminRoleId?: string | null;
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

export interface Appointment {
  id: string;
  userId: string | null;
  barberId: string;
  serviceId: string;
  startDateTime: string; // ISO string
  price: number;
  status: AppointmentStatus;
  notes?: string;
  guestName?: string;
  guestContact?: string;
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
  | 'clients'
  | 'services'
  | 'barbers'
  | 'alerts'
  | 'holidays'
  | 'roles'
  | 'settings';

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
