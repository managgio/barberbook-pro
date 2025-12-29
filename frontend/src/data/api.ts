import {
  users as initialUsers,
  barbers as initialBarbers,
  services as initialServices,
  appointments as initialAppointments,
  alerts as initialAlerts,
  shopSchedule,
  holidaysGeneral,
  holidaysByBarber,
  adminRoles as initialAdminRoles,
  barberSchedules as initialBarberSchedules,
} from './mockData';
import {
  User,
  Barber,
  Service,
  Appointment,
  Alert,
  ShopSchedule,
  HolidayRange,
  AdminRole,
  DaySchedule,
  ShiftSchedule,
} from './types';
import defaultAvatar from '@/assets/img/default-avatar.svg';

const SUPER_ADMIN_EMAIL = 'admin@barberia.com';
const DEFAULT_SERVICE_DURATION = 30;
const SLOT_INTERVAL_MINUTES = 15;

// Simulate network delay
const delay = (ms: number = 300) => new Promise(resolve => setTimeout(resolve, ms));

const toISODate = (value: string) => value.split('T')[0];

const normalizeRange = (range: HolidayRange): HolidayRange => {
  const start = toISODate(range.start);
  const end = toISODate(range.end || range.start);
  if (start <= end) {
    return { start, end };
  }
  return { start: end, end: start };
};

const rangesEqual = (a: HolidayRange, b: HolidayRange) => a.start === b.start && a.end === b.end;

const normalizeRangeList = (input: unknown, fallback: HolidayRange[]) => {
  if (!Array.isArray(input)) return fallback.map((range) => ({ ...range }));
  if (input.length > 0 && typeof input[0] === 'string') {
    return (input as string[]).map((date) => normalizeRange({ start: date, end: date }));
  }
  return (input as HolidayRange[]).map((range) => normalizeRange(range));
};

const normalizeRangeRecord = (input: unknown, fallback: Record<string, HolidayRange[]>) => {
  const record: Record<string, HolidayRange[]> = {};
  const source = typeof input === 'object' && input ? (input as Record<string, unknown>) : fallback;
  Object.entries(source).forEach(([id, ranges]) => {
    record[id] = normalizeRangeList(ranges, fallback[id] || []);
  });
  return record;
};

const isDateInRange = (date: string, range: HolidayRange) =>
  date >= range.start && date <= range.end;

const todayISO = () => toISODate(new Date().toISOString());

const sanitizeBarberPhoto = (photo?: string): string => {
  if (!photo) return defaultAvatar;
  if (photo.includes('images.unsplash.com') || photo.toLowerCase().includes('shadcn')) {
    return defaultAvatar;
  }
  return photo;
};

const normalizeBarber = (barber: Barber): Barber => ({
  ...barber,
  photo: sanitizeBarberPhoto(barber.photo),
  startDate: barber.startDate ? toISODate(barber.startDate) : todayISO(),
  endDate: barber.endDate ? toISODate(barber.endDate) : null,
  isActive: barber.isActive ?? true,
});

const normalizeService = (service: Service): Service => {
  const parsedDuration = Number(service.duration);
  const duration = Number.isFinite(parsedDuration) && parsedDuration > 0
    ? parsedDuration
    : DEFAULT_SERVICE_DURATION;
  return {
    ...service,
    duration,
  };
};

const cloneRole = (role: AdminRole): AdminRole => ({
  ...role,
  permissions: [...role.permissions],
});

const DAY_KEYS: (keyof ShopSchedule)[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const cloneSchedule = (schedule: ShopSchedule): ShopSchedule =>
  JSON.parse(JSON.stringify(schedule));

const cloneDaySchedule = (day: DaySchedule): DaySchedule => ({
  closed: day.closed,
  morning: { ...day.morning },
  afternoon: { ...day.afternoon },
});

const normalizeShift = (
  shift: Partial<ShiftSchedule> | undefined,
  fallback: ShiftSchedule
): ShiftSchedule => ({
  enabled: shift?.enabled ?? fallback.enabled,
  start: shift?.start || fallback.start,
  end: shift?.end || fallback.end,
});

const convertLegacyDay = (
  legacy: { open?: string; close?: string; closed?: boolean } | undefined,
  fallback: DaySchedule
): DaySchedule => {
  if (!legacy) return cloneDaySchedule(fallback);
  const open = legacy.open || fallback.morning.start;
  const close = legacy.close || fallback.afternoon.end;
  const closed = legacy.closed ?? false;
  const morning: ShiftSchedule = {
    enabled: !closed,
    start: open,
    end: close,
  };
  const afternoon: ShiftSchedule = {
    ...fallback.afternoon,
    enabled: false,
  };
  return {
    closed: closed || (!morning.enabled && !afternoon.enabled),
    morning,
    afternoon,
  };
};

const normalizeSchedule = (schedule?: Partial<ShopSchedule>): ShopSchedule => {
  const normalized: Partial<ShopSchedule> = {};
  DAY_KEYS.forEach((day) => {
    const fallback = cloneDaySchedule(shopSchedule[day]);
    const dayData = schedule?.[day] as Partial<DaySchedule> | undefined;
    const isLegacy = dayData && Object.prototype.hasOwnProperty.call(dayData, 'open');
    if (isLegacy) {
      normalized[day] = convertLegacyDay(
        dayData as { open?: string; close?: string; closed?: boolean },
        fallback
      );
      return;
    }
    const morning = normalizeShift(dayData?.morning, fallback.morning);
    const afternoon = normalizeShift(dayData?.afternoon, fallback.afternoon);
    let closed = dayData?.closed ?? fallback.closed;
    if (!morning.enabled && !afternoon.enabled) {
      closed = true;
    }
    normalized[day] = {
      closed,
      morning,
      afternoon,
    };
  });
  return normalized as ShopSchedule;
};

const syncMockUserReference = (updatedUser: User) => {
  const index = initialUsers.findIndex((u) => u.id === updatedUser.id);
  if (index !== -1) {
    initialUsers[index] = { ...updatedUser };
  }
};

const normalizeUserRecord = (user: User): User =>
  user.email === SUPER_ADMIN_EMAIL
    ? { ...user, role: 'admin', isSuperAdmin: true, adminRoleId: null }
    : user;

// In-memory data stores (simulating database)
const ensureSuperAdminFlag = (list: User[]): User[] =>
  list.map((user) =>
    user.email === SUPER_ADMIN_EMAIL
      ? { ...user, role: 'admin', isSuperAdmin: true, adminRoleId: null }
      : user
  );

let users = ensureSuperAdminFlag([...initialUsers]);
let barbers = initialBarbers.map(normalizeBarber);
let services = initialServices.map(normalizeService);
let appointments = [...initialAppointments];
let alerts = [...initialAlerts];
let generalHolidays: HolidayRange[] = holidaysGeneral.map((range) => normalizeRange(range));
let barberSpecificHolidays: Record<string, HolidayRange[]> = Object.fromEntries(
  Object.entries(holidaysByBarber).map(([id, ranges]) => [id, ranges.map((range) => normalizeRange(range))])
);
let adminRolesStore: AdminRole[] = initialAdminRoles.map(cloneRole);
let barberSchedulesStore: Record<string, ShopSchedule> = Object.fromEntries(
  Object.entries(initialBarberSchedules).map(([id, schedule]) => [id, normalizeSchedule(schedule)])
);

// Load from localStorage if available
const loadFromStorage = () => {
  try {
    const stored = localStorage.getItem('barberia-data');
    if (stored) {
      const data = JSON.parse(stored);
      users = ensureSuperAdminFlag(data.users || initialUsers);
      barbers = (data.barbers || initialBarbers).map(normalizeBarber);
      services = (data.services || initialServices).map(normalizeService);
      appointments = data.appointments || initialAppointments;
      alerts = data.alerts || initialAlerts;
      generalHolidays = normalizeRangeList(data.generalHolidays, holidaysGeneral);
      barberSpecificHolidays = normalizeRangeRecord(data.barberSpecificHolidays, holidaysByBarber);
      adminRolesStore = (data.adminRoles || initialAdminRoles).map(cloneRole);
      barberSchedulesStore = Object.fromEntries(
        Object.entries(data.barberSchedules || initialBarberSchedules).map(([id, schedule]) => [
          id,
          normalizeSchedule(schedule),
        ])
      );
    }
  } catch (e) {
    console.error('Error loading from storage:', e);
  }
};

const saveToStorage = () => {
  try {
    localStorage.setItem('barberia-data', JSON.stringify({
      users,
      barbers,
      services,
      appointments,
      alerts,
      generalHolidays,
      barberSpecificHolidays,
      adminRoles: adminRolesStore,
      barberSchedules: barberSchedulesStore,
    }));
  } catch (e) {
    console.error('Error saving to storage:', e);
  }
};

// Initialize
loadFromStorage();

// Users API
export const getUsers = async (): Promise<User[]> => {
  await delay();
  return [...users];
};

export const getUserById = async (id: string): Promise<User | undefined> => {
  await delay(200);
  return users.find(u => u.id === id);
};

export const getUserByEmail = async (email: string): Promise<User | undefined> => {
  await delay(200);
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase());
};

export const getUserByFirebaseUid = async (firebaseUid: string): Promise<User | undefined> => {
  await delay(200);
  return users.find((u) => u.firebaseUid === firebaseUid);
};

export const createUser = async (data: Omit<User, 'id'> & { id?: string }): Promise<User> => {
  await delay();
  const existing = data.email
    ? users.find((u) => u.email.toLowerCase() === data.email.toLowerCase())
    : undefined;
  if (existing) return existing;

  const newUser: User = normalizeUserRecord({
    ...data,
    id: data.id || `user-${Date.now()}`,
  });

  users.push(newUser);
  syncMockUserReference(newUser);
  saveToStorage();
  return newUser;
};

export const updateUser = async (id: string, data: Partial<User>): Promise<User> => {
  await delay();
  const index = users.findIndex(u => u.id === id);
  if (index === -1) throw new Error('User not found');
  const updated = normalizeUserRecord({ ...users[index], ...data });
  users[index] = updated;
  syncMockUserReference(users[index]);
  saveToStorage();
  return users[index];
};

// Barbers API
export const getBarbers = async (): Promise<Barber[]> => {
  await delay();
  return [...barbers];
};

export const getBarberById = async (id: string): Promise<Barber | undefined> => {
  await delay(200);
  return barbers.find(b => b.id === id);
};

export const createBarber = async (data: Omit<Barber, 'id'>): Promise<Barber> => {
  await delay();
  const newBarber: Barber = normalizeBarber({ ...data, id: `barber-${Date.now()}` });
  barbers.push(newBarber);
  saveToStorage();
  return newBarber;
};

export const updateBarber = async (id: string, data: Partial<Barber>): Promise<Barber> => {
  await delay();
  const index = barbers.findIndex(b => b.id === id);
  if (index === -1) throw new Error('Barber not found');
  barbers[index] = normalizeBarber({ ...barbers[index], ...data });
  saveToStorage();
  return barbers[index];
};

export const deleteBarber = async (id: string): Promise<void> => {
  await delay();
  barbers = barbers.filter(b => b.id !== id);
  saveToStorage();
};

// Services API
export const getServices = async (): Promise<Service[]> => {
  await delay();
  return [...services];
};

export const getServiceById = async (id: string): Promise<Service | undefined> => {
  await delay(200);
  return services.find(s => s.id === id);
};

export const createService = async (data: Omit<Service, 'id'>): Promise<Service> => {
  await delay();
  const newService: Service = normalizeService({ ...data, id: `service-${Date.now()}` });
  services.push(newService);
  saveToStorage();
  return newService;
};

export const updateService = async (id: string, data: Partial<Service>): Promise<Service> => {
  await delay();
  const index = services.findIndex(s => s.id === id);
  if (index === -1) throw new Error('Service not found');
  services[index] = normalizeService({ ...services[index], ...data });
  saveToStorage();
  return services[index];
};

export const deleteService = async (id: string): Promise<void> => {
  await delay();
  services = services.filter(s => s.id !== id);
  saveToStorage();
};

// Appointments API
export const getAppointments = async (): Promise<Appointment[]> => {
  await delay();
  return [...appointments];
};

export const getAppointmentById = async (id: string): Promise<Appointment | undefined> => {
  await delay(200);
  return appointments.find(a => a.id === id);
};

export const getAppointmentsByUser = async (userId: string): Promise<Appointment[]> => {
  await delay();
  return appointments.filter(a => a.userId === userId);
};

export const getAppointmentsByBarber = async (barberId: string): Promise<Appointment[]> => {
  await delay();
  return appointments.filter(a => a.barberId === barberId);
};

export const getAppointmentsByDate = async (date: string): Promise<Appointment[]> => {
  await delay();
  return appointments.filter(a => a.startDateTime.startsWith(date));
};

export const createAppointment = async (data: Omit<Appointment, 'id'>): Promise<Appointment> => {
  await delay();
  const newAppointment: Appointment = { ...data, id: `apt-${Date.now()}` };
  appointments.push(newAppointment);
  saveToStorage();
  return newAppointment;
};

export const updateAppointment = async (id: string, data: Partial<Appointment>): Promise<Appointment> => {
  await delay();
  const index = appointments.findIndex(a => a.id === id);
  if (index === -1) throw new Error('Appointment not found');
  appointments[index] = { ...appointments[index], ...data };
  saveToStorage();
  return appointments[index];
};

export const deleteAppointment = async (id: string): Promise<void> => {
  await delay();
  appointments = appointments.filter(a => a.id !== id);
  saveToStorage();
};

// Barber schedules API
export const getBarberSchedule = async (barberId: string): Promise<ShopSchedule> => {
  await delay(200);
  const schedule = barberSchedulesStore[barberId] || normalizeSchedule();
  if (!barberSchedulesStore[barberId]) {
    barberSchedulesStore[barberId] = schedule;
    saveToStorage();
  }
  return cloneSchedule(schedule);
};

export const updateBarberSchedule = async (barberId: string, schedule: ShopSchedule): Promise<ShopSchedule> => {
  await delay(200);
  barberSchedulesStore[barberId] = normalizeSchedule(schedule);
  saveToStorage();
  return cloneSchedule(barberSchedulesStore[barberId]);
};

// Admin Roles API
export const getAdminRoles = async (): Promise<AdminRole[]> => {
  await delay(200);
  return adminRolesStore.map(cloneRole);
};

export const createAdminRole = async (data: Omit<AdminRole, 'id'>): Promise<AdminRole> => {
  await delay();
  const newRole: AdminRole = {
    id: `role-${Date.now()}`,
    name: data.name,
    description: data.description,
    permissions: [...data.permissions],
  };
  adminRolesStore.push(newRole);
  saveToStorage();
  return cloneRole(newRole);
};

export const updateAdminRole = async (id: string, data: Partial<AdminRole>): Promise<AdminRole> => {
  await delay();
  const index = adminRolesStore.findIndex((role) => role.id === id);
  if (index === -1) throw new Error('Role not found');
  const updated: AdminRole = {
    ...adminRolesStore[index],
    ...data,
    permissions: data.permissions ? [...data.permissions] : [...adminRolesStore[index].permissions],
  };
  adminRolesStore[index] = updated;
  saveToStorage();
  return cloneRole(updated);
};

export const deleteAdminRole = async (id: string): Promise<void> => {
  await delay();
  adminRolesStore = adminRolesStore.filter((role) => role.id !== id);
  users = users.map((user) => {
    if (user.adminRoleId === id) {
      const updated = { ...user, adminRoleId: null };
      syncMockUserReference(updated);
      return updated;
    }
    return user;
  });
  saveToStorage();
};

// Alerts API
export const getAlerts = async (): Promise<Alert[]> => {
  await delay();
  return [...alerts];
};

export const getActiveAlerts = async (): Promise<Alert[]> => {
  await delay(200);
  return alerts.filter(a => a.active);
};

export const createAlert = async (data: Omit<Alert, 'id'>): Promise<Alert> => {
  await delay();
  const newAlert: Alert = { ...data, id: `alert-${Date.now()}` };
  alerts.push(newAlert);
  saveToStorage();
  return newAlert;
};

export const updateAlert = async (id: string, data: Partial<Alert>): Promise<Alert> => {
  await delay();
  const index = alerts.findIndex(a => a.id === id);
  if (index === -1) throw new Error('Alert not found');
  alerts[index] = { ...alerts[index], ...data };
  saveToStorage();
  return alerts[index];
};

export const deleteAlert = async (id: string): Promise<void> => {
  await delay();
  alerts = alerts.filter(a => a.id !== id);
  saveToStorage();
};

// Schedule API
export const getShopSchedule = async (): Promise<ShopSchedule> => {
  await delay(200);
  return cloneSchedule(shopSchedule);
};

export const getHolidaysGeneral = async (): Promise<HolidayRange[]> => {
  await delay(200);
  return generalHolidays.map((range) => ({ ...range }));
};

export const getHolidaysByBarber = async (barberId: string): Promise<HolidayRange[]> => {
  await delay(200);
  const ranges = barberSpecificHolidays[barberId] || [];
  return ranges.map((range) => ({ ...range }));
};

export const addGeneralHolidayRange = async (range: HolidayRange): Promise<HolidayRange[]> => {
  await delay(200);
  const normalized = normalizeRange(range);
  if (!generalHolidays.some((existing) => rangesEqual(existing, normalized))) {
    generalHolidays.push(normalized);
    saveToStorage();
  }
  return generalHolidays.map((item) => ({ ...item }));
};

export const removeGeneralHolidayRange = async (range: HolidayRange): Promise<HolidayRange[]> => {
  await delay(200);
  const normalized = normalizeRange(range);
  generalHolidays = generalHolidays.filter((existing) => !rangesEqual(existing, normalized));
  saveToStorage();
  return generalHolidays.map((item) => ({ ...item }));
};

export const addBarberHolidayRange = async (barberId: string, range: HolidayRange): Promise<HolidayRange[]> => {
  await delay(200);
  const normalized = normalizeRange(range);
  const existing = barberSpecificHolidays[barberId] || [];
  if (!existing.some((item) => rangesEqual(item, normalized))) {
    barberSpecificHolidays[barberId] = [...existing, normalized];
    saveToStorage();
  }
  return barberSpecificHolidays[barberId].map((item) => ({ ...item }));
};

export const removeBarberHolidayRange = async (barberId: string, range: HolidayRange): Promise<HolidayRange[]> => {
  await delay(200);
  const normalized = normalizeRange(range);
  const existing = barberSpecificHolidays[barberId] || [];
  barberSpecificHolidays[barberId] = existing.filter((item) => !rangesEqual(item, normalized));
  saveToStorage();
  return barberSpecificHolidays[barberId].map((item) => ({ ...item }));
};

const timeToMinutes = (time: string): number => {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
};

const minutesToTime = (minutes: number): string => {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

const getServiceDuration = (serviceId?: string): number => {
  if (!serviceId) return DEFAULT_SERVICE_DURATION;
  const service = services.find((s) => s.id === serviceId);
  return service?.duration ?? DEFAULT_SERVICE_DURATION;
};

const generateSlotsForShift = (shift: ShiftSchedule, serviceDuration: number): string[] => {
  if (!shift.enabled) return [];
  const startMinutes = timeToMinutes(shift.start);
  const endMinutes = timeToMinutes(shift.end);
  const slots: string[] = [];

  if (startMinutes >= endMinutes || serviceDuration <= 0) return slots;

  for (
    let current = startMinutes;
    current + serviceDuration <= endMinutes;
    current += SLOT_INTERVAL_MINUTES
  ) {
    slots.push(minutesToTime(current));
  }

  return slots;
};

// Availability check
export const getAvailableSlots = async (
  barberId: string,
  date: string,
  options?: { serviceId?: string; appointmentIdToIgnore?: string }
): Promise<string[]> => {
  await delay(400);
  const barber = barbers.find((b) => b.id === barberId);
  if (!barber || barber.isActive === false) return [];
  if (barber.startDate && date < barber.startDate) return [];
  if (barber.endDate && date > barber.endDate) return [];

  const dateObj = new Date(date);
  const dayOfWeek = dateObj
    .toLocaleDateString('en-US', { weekday: 'long' })
    .toLowerCase() as keyof ShopSchedule;
  const weeklySchedule = barberSchedulesStore[barberId] || shopSchedule;
  const schedule = weeklySchedule[dayOfWeek] || shopSchedule[dayOfWeek];

  if (schedule.closed) return [];

  if (generalHolidays.some((range) => isDateInRange(date, range))) return [];

  const barberHolidays = barberSpecificHolidays[barberId] || [];
  if (barberHolidays.some((range) => isDateInRange(date, range))) return [];

  const targetDuration = getServiceDuration(options?.serviceId);

  const rawSlots = [
    ...generateSlotsForShift(schedule.morning, targetDuration),
    ...generateSlotsForShift(schedule.afternoon, targetDuration),
  ];
  if (rawSlots.length === 0) return [];

  const uniqueSlots = Array.from(new Set(rawSlots));

  const bookedAppointments = appointments.filter(
    (a) =>
      a.barberId === barberId &&
      a.startDateTime.startsWith(date) &&
      a.status !== 'cancelled' &&
      a.id !== options?.appointmentIdToIgnore
  );

  const bookedRanges = bookedAppointments.map((a) => {
    const d = new Date(a.startDateTime);
    const startMinutes = d.getHours() * 60 + d.getMinutes();
    const duration = getServiceDuration(a.serviceId);
    return {
      start: startMinutes,
      end: startMinutes + duration,
    };
  });

  return uniqueSlots.filter((slot) => {
    const slotStart = timeToMinutes(slot);
    const slotEnd = slotStart + targetDuration;
    return bookedRanges.every(
      (range) => slotEnd <= range.start || slotStart >= range.end
    );
  });
};
