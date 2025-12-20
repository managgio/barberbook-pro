export type UserRole = 'client' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  notificationPrefs: {
    email: boolean;
    whatsapp: boolean;
  };
  avatar?: string;
  isSuperAdmin?: boolean;
  adminRoleId?: string | null;
}

export interface Barber {
  id: string;
  name: string;
  photo: string;
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
  duration: 30; // Always 30 minutes
}

export type AppointmentStatus = 'confirmed' | 'completed' | 'cancelled';

export interface Appointment {
  id: string;
  userId: string;
  barberId: string;
  serviceId: string;
  startDateTime: string; // ISO string
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
  | 'roles';

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
}

export interface HolidayRange {
  start: string;
  end: string;
}
