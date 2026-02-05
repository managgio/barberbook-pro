import { AdminSectionKey } from './types';
import type { BusinessCopy } from '@/lib/businessCopy';

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
    description: 'Historial completo de citas filtrado por profesional o fecha.',
  },
  {
    key: 'offers',
    label: 'Ofertas',
    description: 'Promociones programables para servicios y productos.',
  },
  {
    key: 'cash-register',
    label: 'Caja Registradora',
    description: 'Control diario de ingresos, salidas y medios de pago.',
  },
  {
    key: 'stock',
    label: 'Control de stock',
    description: 'Inventario de productos, precios y alertas de stock.',
  },
  {
    key: 'clients',
    label: 'Clientes',
    description: 'Gestión de clientes y su historial de visitas.',
  },
  {
    key: 'services',
    label: 'Servicios',
    description: 'Catálogo de servicios disponibles en el negocio.',
  },
  {
    key: 'barbers',
    label: 'Barberos',
    description: 'Administración del equipo de estilistas.',
  },
  {
    key: 'loyalty',
    label: 'Fidelización',
    description: 'Tarjetas de fidelización y recompensas para clientes.',
  },
  {
    key: 'referrals',
    label: 'Referidos',
    description: 'Programa de referidos, recompensas y atribuciones.',
  },
  {
    key: 'reviews',
    label: 'Reseñas',
    description: 'Solicitudes in-app para reseñas y feedback privado.',
  },
  {
    key: 'alerts',
    label: 'Alertas',
    description: 'Mensajes destacados o avisos para clientes.',
  },
  {
    key: 'holidays',
    label: 'Festivos',
    description: 'Bloqueo de días no laborables generales o por profesional.',
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

export const resolveAdminSectionLabel = (
  section: { key: AdminSectionKey; label: string },
  copy?: BusinessCopy | null,
) => {
  if (!copy) return section.label;
  if (section.key === 'barbers') return copy.staff.plural;
  return section.label;
};

export const resolveAdminSectionDescription = (
  section: { key: AdminSectionKey; description: string },
  copy?: BusinessCopy | null,
) => {
  if (!copy) return section.description;
  switch (section.key) {
    case 'search':
      return `Historial completo de citas filtrado por ${copy.staff.singularLower} o fecha.`;
    case 'services':
      return `Catálogo de servicios disponibles en ${copy.location.definiteSingular}.`;
    case 'barbers':
      return `Administración ${copy.staff.fromWithDefinitePlural}.`;
    case 'holidays':
      return `Bloqueo de días no laborables generales o por ${copy.staff.singularLower}.`;
    default:
      return section.description;
  }
};

export const getAdminSections = (copy?: BusinessCopy | null) =>
  ADMIN_SECTIONS.map((section) => ({
    ...section,
    label: resolveAdminSectionLabel(section, copy),
    description: resolveAdminSectionDescription(section, copy),
  }));
