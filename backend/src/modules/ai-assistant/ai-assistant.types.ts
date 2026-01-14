export type AiToolName = 'add_shop_holiday' | 'add_barber_holiday' | 'create_appointment';

export interface AiToolContext {
  adminUserId: string;
  timeZone: string;
  now: Date;
}

export interface AiHolidayActionResult {
  status: 'added' | 'needs_info' | 'error';
  scope: 'shop' | 'barber';
  range?: { start: string; end: string };
  barberIds?: string[];
  barberNames?: string[];
  added?: number;
  missing?: string[];
  options?: {
    barbers?: { id: string; name: string; isActive: boolean }[];
  };
}

export interface AiCreateAppointmentResult {
  status: 'created' | 'needs_info' | 'unavailable' | 'error';
  missing?: string[];
  reason?: string;
  options?: {
    barbers?: { id: string; name: string }[];
    services?: { id: string; name: string; duration: number }[];
    users?: { id: string; name: string; email: string }[];
  };
  appointmentId?: string;
  startDateTime?: string;
  barberId?: string;
  barberName?: string;
  serviceId?: string;
  serviceName?: string;
  userType?: 'registered' | 'guest';
  guestName?: string;
  clientName?: string;
  matchCount?: number;
}
