import { AdminSectionKey } from './types';

export const ADMIN_SECTIONS: { key: AdminSectionKey; label: string; description: string }[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    description: 'Resumen general de actividad y métricas.',
  },
  {
    key: 'calendar',
    label: 'Calendario',
    description: 'Planificación semanal y control de citas.',
  },
  {
    key: 'search',
    label: 'Buscar citas',
    description: 'Historial completo de citas filtrado por barbero o fecha.',
  },
  {
    key: 'cash-register',
    label: 'Caja Registradora',
    description: 'Control diario de ingresos, salidas y medios de pago.',
  },
  {
    key: 'clients',
    label: 'Clientes',
    description: 'Gestión de clientes y su historial de visitas.',
  },
  {
    key: 'services',
    label: 'Servicios',
    description: 'Catálogo de servicios disponibles en el salón.',
  },
  {
    key: 'barbers',
    label: 'Barberos',
    description: 'Administración del equipo de estilistas.',
  },
  {
    key: 'alerts',
    label: 'Alertas',
    description: 'Mensajes destacados o avisos para clientes.',
  },
  {
    key: 'holidays',
    label: 'Festivos',
    description: 'Bloqueo de días no laborables generales o por barbero.',
  },
  {
    key: 'roles',
    label: 'Roles y permisos',
    description: 'Configuración de roles administrativos y accesos.',
  },
  {
    key: 'settings',
    label: 'Configuración',
    description: 'Datos generales, redes y horario de apertura.',
  },
];

export const ADMIN_SECTION_KEYS: AdminSectionKey[] = ADMIN_SECTIONS.map((section) => section.key);

export const ADMIN_REQUIRED_SECTIONS: AdminSectionKey[] = [
  'dashboard',
  'calendar',
  'search',
  'clients',
  'services',
  'barbers',
  'holidays',
  'settings',
];
