import { PrismaClient } from '@prisma/client';
import { DEFAULT_SHOP_SCHEDULE } from '../src/modules/schedules/schedule.types';

const prisma = new PrismaClient();
const SUPER_ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL || 'admin@barberia.com').toLowerCase();

const adminRoles = [
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

const users = [
  {
    id: 'user-1',
    name: 'Carlos García',
    email: 'carlos@example.com',
    phone: '+34 612 345 678',
    role: 'client' as const,
    notificationEmail: true,
    notificationWhatsapp: true,
    adminRoleId: null,
    isSuperAdmin: false,
  },
  {
    id: 'user-2',
    name: 'Admin Demo',
    email: SUPER_ADMIN_EMAIL,
    phone: '+34 600 000 000',
    role: 'admin' as const,
    notificationEmail: true,
    notificationWhatsapp: false,
    adminRoleId: null,
    isSuperAdmin: true,
  },
  {
    id: 'user-3',
    name: 'María López',
    email: 'maria@example.com',
    phone: '+34 698 765 432',
    role: 'client' as const,
    notificationEmail: false,
    notificationWhatsapp: true,
    adminRoleId: null,
    isSuperAdmin: false,
  },
];

const barbers = [
  {
    id: 'barber-1',
    name: 'Miguel Ángel',
    specialty: 'Cortes clásicos',
    role: 'admin' as const,
    bio: 'Más de 15 años de experiencia en cortes tradicionales y modernos.',
    startDate: '2024-01-01',
    endDate: null,
    isActive: true,
    photo: null,
  },
  {
    id: 'barber-2',
    name: 'Alejandro Ruiz',
    specialty: 'Degradados & Fades',
    role: 'worker' as const,
    bio: 'Especialista en degradados y técnicas modernas de barbería.',
    startDate: '2024-03-01',
    endDate: null,
    isActive: true,
    photo: null,
  },
  {
    id: 'barber-3',
    name: 'David Fernández',
    specialty: 'Barba & Afeitado',
    role: 'worker' as const,
    bio: 'Experto en cuidado de barba y afeitado tradicional con navaja.',
    startDate: '2024-02-15',
    endDate: null,
    isActive: true,
    photo: null,
  },
  {
    id: 'barber-4',
    name: 'Pablo Martín',
    specialty: 'Estilos urbanos',
    role: 'worker' as const,
    bio: 'Creador de estilos únicos y tendencias urbanas.',
    startDate: '2024-04-01',
    endDate: null,
    isActive: true,
    photo: null,
  },
];

const services = [
  { id: 'service-1', name: 'Corte clásico', description: 'Corte tradicional con tijera y máquina, incluye lavado.', price: 18, duration: 30 },
  { id: 'service-2', name: 'Degradado fade', description: 'Corte con degradado profesional, varios estilos disponibles.', price: 22, duration: 45 },
  { id: 'service-3', name: 'Arreglo de barba', description: 'Perfilado y recorte de barba con acabado perfecto.', price: 12, duration: 20 },
  { id: 'service-4', name: 'Afeitado clásico', description: 'Afeitado tradicional con navaja y toalla caliente.', price: 20, duration: 35 },
  { id: 'service-5', name: 'Corte + Barba', description: 'Combo completo: corte de pelo y arreglo de barba.', price: 28, duration: 60 },
  { id: 'service-6', name: 'Tratamiento capilar', description: 'Tratamiento hidratante y nutritivo para el cabello.', price: 15, duration: 45 },
];
const servicePriceMap = Object.fromEntries(services.map((service) => [service.id, service.price]));

const alerts = [
  {
    id: 'alert-1',
    title: '¡Felices Fiestas!',
    message: 'Durante las fiestas navideñas tendremos horario especial. Consulta disponibilidad.',
    active: true,
    type: 'info' as const,
  },
  {
    id: 'alert-2',
    title: 'Nuevo servicio',
    message: 'Ya disponible nuestro tratamiento capilar premium.',
    active: false,
    type: 'success' as const,
  },
];

const generalHolidays = [
  { start: '2025-01-01', end: '2025-01-01' },
  { start: '2025-01-06', end: '2025-01-06' },
  { start: '2025-03-18', end: '2025-03-19' },
  { start: '2025-12-24', end: '2025-12-26' },
];

const holidaysByBarber: Record<string, { start: string; end: string }[]> = {
  'barber-1': [{ start: '2025-12-20', end: '2025-12-21' }],
  'barber-2': [{ start: '2025-12-22', end: '2025-12-23' }],
  'barber-3': [{ start: '2025-12-18', end: '2025-12-19' }],
  'barber-4': [{ start: '2025-12-17', end: '2025-12-17' }],
};

async function main() {
  console.log('Seeding database...');

  await prisma.appointment.deleteMany();
  await prisma.barberHoliday.deleteMany();
  await prisma.generalHoliday.deleteMany();
  await prisma.barberSchedule.deleteMany();
  await prisma.shopSchedule.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.service.deleteMany();
  await prisma.barber.deleteMany();
  await prisma.user.deleteMany();
  await prisma.adminRole.deleteMany();

  for (const role of adminRoles) {
    await prisma.adminRole.create({ data: role });
  }

  for (const user of users) {
    await prisma.user.create({ data: user });
  }

  for (const barber of barbers) {
    await prisma.barber.create({
      data: {
        ...barber,
        startDate: new Date(barber.startDate),
        endDate: barber.endDate ? new Date(barber.endDate) : null,
      },
    });
  }

  for (const service of services) {
    await prisma.service.create({ data: service });
  }

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(today);
  dayAfter.setDate(dayAfter.getDate() + 2);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const appointments = [
    {
      id: 'apt-1',
      userId: 'user-1',
      barberId: 'barber-1',
      serviceId: 'service-2',
      startDateTime: new Date(tomorrow.setHours(10, 0, 0, 0)),
      status: 'scheduled' as const,
      price: servicePriceMap['service-2'],
      reminderSent: false,
    },
    {
      id: 'apt-2',
      userId: 'user-1',
      barberId: 'barber-2',
      serviceId: 'service-5',
      startDateTime: new Date(yesterday.setHours(11, 30, 0, 0)),
      status: 'completed' as const,
      price: servicePriceMap['service-5'],
      reminderSent: false,
    },
    {
      id: 'apt-3',
      userId: 'user-3',
      barberId: 'barber-1',
      serviceId: 'service-1',
      startDateTime: new Date(today.setHours(15, 0, 0, 0)),
      status: 'scheduled' as const,
      price: servicePriceMap['service-1'],
      reminderSent: false,
    },
    {
      id: 'apt-4',
      userId: 'user-3',
      barberId: 'barber-3',
      serviceId: 'service-3',
      startDateTime: new Date(dayAfter.setHours(12, 0, 0, 0)),
      status: 'scheduled' as const,
      price: servicePriceMap['service-3'],
      reminderSent: false,
    },
  ];

  for (const alert of alerts) {
    await prisma.alert.create({ data: alert });
  }

  await prisma.shopSchedule.create({ data: { id: 1, data: DEFAULT_SHOP_SCHEDULE } });

  for (const appointment of appointments) {
    await prisma.appointment.create({ data: appointment });
  }

  for (const range of generalHolidays) {
    await prisma.generalHoliday.create({
      data: {
        start: new Date(range.start),
        end: new Date(range.end),
      },
    });
  }

  for (const [barberId, ranges] of Object.entries(holidaysByBarber)) {
    for (const range of ranges) {
      await prisma.barberHoliday.create({
        data: {
          barberId,
          start: new Date(range.start),
          end: new Date(range.end),
        },
      });
    }
  }

  console.log('Database seeded');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
