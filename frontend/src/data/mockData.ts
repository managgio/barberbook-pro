import { User, Barber, Service, Appointment, ShopSchedule, Alert, AdminRole, DaySchedule } from './types';

const createDaySchedule = (
  morning: [string, string] | null,
  afternoon: [string, string] | null
): DaySchedule => ({
  closed: !morning && !afternoon,
  morning: {
    enabled: Boolean(morning),
    start: morning ? morning[0] : '00:00',
    end: morning ? morning[1] : '00:00',
  },
  afternoon: {
    enabled: Boolean(afternoon),
    start: afternoon ? afternoon[0] : '00:00',
    end: afternoon ? afternoon[1] : '00:00',
  },
});

export const users: User[] = [
  {
    id: 'user-1',
    name: 'Carlos García',
    email: 'carlos@example.com',
    phone: '+34 612 345 678',
    role: 'client',
    notificationPrefs: { email: true, whatsapp: true },
    adminRoleId: null,
  },
  {
    id: 'user-2',
    name: 'Admin Demo',
    email: 'admin@barberia.com',
    phone: '+34 600 000 000',
    role: 'admin',
    notificationPrefs: { email: true, whatsapp: false },
    isSuperAdmin: true,
    adminRoleId: null,
  },
  {
    id: 'user-3',
    name: 'María López',
    email: 'maria@example.com',
    phone: '+34 698 765 432',
    role: 'client',
    notificationPrefs: { email: false, whatsapp: true },
    adminRoleId: null,
  },
];

export const adminRoles: AdminRole[] = [
  {
    id: 'role-manager',
    name: 'Manager',
    description: 'Control del día a día del salón.',
    permissions: ['dashboard', 'calendar', 'search', 'clients', 'services', 'barbers'],
  },
  {
    id: 'role-frontdesk',
    name: 'Recepción',
    description: 'Solo operaciones básicas de agenda.',
    permissions: ['dashboard', 'calendar', 'search', 'clients'],
  },
];

export const barbers: Barber[] = [
  {
    id: 'barber-1',
    name: 'Miguel Ángel',
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face',
    specialty: 'Cortes clásicos',
    role: 'admin',
    bio: 'Más de 15 años de experiencia en cortes tradicionales y modernos.',
    startDate: '2024-01-01',
    endDate: null,
    isActive: true,
  },
  {
    id: 'barber-2',
    name: 'Alejandro Ruiz',
    photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face',
    specialty: 'Degradados & Fades',
    role: 'worker',
    bio: 'Especialista en degradados y técnicas modernas de barbería.',
    startDate: '2024-03-01',
    endDate: null,
    isActive: true,
  },
  {
    id: 'barber-3',
    name: 'David Fernández',
    photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&crop=face',
    specialty: 'Barba & Afeitado',
    role: 'worker',
    bio: 'Experto en cuidado de barba y afeitado tradicional con navaja.',
    startDate: '2024-02-15',
    endDate: null,
    isActive: true,
  },
  {
    id: 'barber-4',
    name: 'Pablo Martín',
    photo: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&h=400&fit=crop&crop=face',
    specialty: 'Estilos urbanos',
    role: 'worker',
    bio: 'Creador de estilos únicos y tendencias urbanas.',
    startDate: '2024-04-01',
    endDate: null,
    isActive: true,
  },
];

export const services: Service[] = [
  {
    id: 'service-1',
    name: 'Corte clásico',
    description: 'Corte tradicional con tijera y máquina, incluye lavado.',
    price: 18,
    duration: 30,
  },
  {
    id: 'service-2',
    name: 'Degradado fade',
    description: 'Corte con degradado profesional, varios estilos disponibles.',
    price: 22,
    duration: 30,
  },
  {
    id: 'service-3',
    name: 'Arreglo de barba',
    description: 'Perfilado y recorte de barba con acabado perfecto.',
    price: 12,
    duration: 30,
  },
  {
    id: 'service-4',
    name: 'Afeitado clásico',
    description: 'Afeitado tradicional con navaja y toalla caliente.',
    price: 20,
    duration: 30,
  },
  {
    id: 'service-5',
    name: 'Corte + Barba',
    description: 'Combo completo: corte de pelo y arreglo de barba.',
    price: 28,
    duration: 30,
  },
  {
    id: 'service-6',
    name: 'Tratamiento capilar',
    description: 'Tratamiento hidratante y nutritivo para el cabello.',
    price: 15,
    duration: 30,
  },
];

// Generate some appointments
const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);
const dayAfter = new Date(today);
dayAfter.setDate(dayAfter.getDate() + 2);
const yesterday = new Date(today);
yesterday.setDate(yesterday.getDate() - 1);

export const appointments: Appointment[] = [
  {
    id: 'apt-1',
    userId: 'user-1',
    barberId: 'barber-1',
    serviceId: 'service-2',
    startDateTime: new Date(tomorrow.setHours(10, 0, 0, 0)).toISOString(),
    status: 'confirmed',
  },
  {
    id: 'apt-2',
    userId: 'user-1',
    barberId: 'barber-2',
    serviceId: 'service-5',
    startDateTime: new Date(yesterday.setHours(11, 30, 0, 0)).toISOString(),
    status: 'completed',
  },
  {
    id: 'apt-3',
    userId: 'user-3',
    barberId: 'barber-1',
    serviceId: 'service-1',
    startDateTime: new Date(today.setHours(15, 0, 0, 0)).toISOString(),
    status: 'confirmed',
  },
  {
    id: 'apt-4',
    userId: 'user-3',
    barberId: 'barber-3',
    serviceId: 'service-3',
    startDateTime: new Date(dayAfter.setHours(12, 0, 0, 0)).toISOString(),
    status: 'confirmed',
  },
];

export const shopSchedule: ShopSchedule = {
  monday: createDaySchedule(['09:00', '14:00'], ['15:00', '20:00']),
  tuesday: createDaySchedule(['09:00', '14:00'], ['15:00', '20:00']),
  wednesday: createDaySchedule(['09:00', '14:00'], ['15:00', '20:00']),
  thursday: createDaySchedule(['09:00', '14:00'], ['15:00', '20:00']),
  friday: createDaySchedule(['09:00', '14:00'], ['15:00', '21:00']),
  saturday: createDaySchedule(['09:30', '13:30'], ['15:30', '18:00']),
  sunday: createDaySchedule(null, null),
};

export const barberSchedules: Record<string, ShopSchedule> = {};

// General shop holidays (ranges with inclusive dates)
export const holidaysGeneral: HolidayRange[] = [
  { start: '2025-01-01', end: '2025-01-01' },
  { start: '2025-01-06', end: '2025-01-06' },
  { start: '2025-03-18', end: '2025-03-19' },
  { start: '2025-12-24', end: '2025-12-26' },
];

// Holidays by barber (barberId -> ranges)
export const holidaysByBarber: Record<string, HolidayRange[]> = {
  'barber-1': [{ start: '2025-12-20', end: '2025-12-21' }],
  'barber-2': [{ start: '2025-12-22', end: '2025-12-23' }],
  'barber-3': [{ start: '2025-12-18', end: '2025-12-19' }],
  'barber-4': [{ start: '2025-12-17', end: '2025-12-17' }],
};

export const alerts: Alert[] = [
  {
    id: 'alert-1',
    title: '¡Felices Fiestas!',
    message: 'Durante las fiestas navideñas tendremos horario especial. Consulta disponibilidad.',
    active: true,
    type: 'info',
  },
  {
    id: 'alert-2',
    title: 'Nuevo servicio',
    message: 'Ya disponible nuestro tratamiento capilar premium.',
    active: false,
    type: 'success',
  },
];
