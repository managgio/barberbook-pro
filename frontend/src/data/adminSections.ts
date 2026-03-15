import { AdminSectionKey } from './types';
import type { BusinessCopy } from '@/lib/businessCopy';

type AdminSectionDefinition = {
  key: AdminSectionKey;
  label: string;
  labelKey: string;
  description: string;
  descriptionKey: string;
};

type AdminSectionTranslator = (key: string, values?: Record<string, string | number>) => string;

export const ADMIN_SECTIONS: AdminSectionDefinition[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    labelKey: 'admin.section.dashboard.label',
    description: 'Resumen general de actividad y métricas.',
    descriptionKey: 'admin.section.dashboard.description',
  },
  {
    key: 'calendar',
    label: 'Calendario',
    labelKey: 'admin.section.calendar.label',
    description: 'Planificación semanal y control de citas.',
    descriptionKey: 'admin.section.calendar.description',
  },
  {
    key: 'search',
    label: 'Buscar citas',
    labelKey: 'admin.section.search.label',
    description: 'Historial completo de citas filtrado por profesional o fecha.',
    descriptionKey: 'admin.section.search.description',
  },
  {
    key: 'offers',
    label: 'Ofertas',
    labelKey: 'admin.section.offers.label',
    description: 'Promociones programables para servicios y productos.',
    descriptionKey: 'admin.section.offers.description',
  },
  {
    key: 'cash-register',
    label: 'Caja Registradora',
    labelKey: 'admin.section.cashRegister.label',
    description: 'Control diario de ingresos, salidas y medios de pago.',
    descriptionKey: 'admin.section.cashRegister.description',
  },
  {
    key: 'stock',
    label: 'Control de stock',
    labelKey: 'admin.section.stock.label',
    description: 'Inventario de productos, precios y alertas de stock.',
    descriptionKey: 'admin.section.stock.description',
  },
  {
    key: 'clients',
    label: 'Clientes',
    labelKey: 'admin.section.clients.label',
    description: 'Gestión de clientes y su historial de visitas.',
    descriptionKey: 'admin.section.clients.description',
  },
  {
    key: 'services',
    label: 'Servicios',
    labelKey: 'admin.section.services.label',
    description: 'Catálogo de servicios disponibles en el negocio.',
    descriptionKey: 'admin.section.services.description',
  },
  {
    key: 'barbers',
    label: 'Barberos',
    labelKey: 'admin.section.barbers.label',
    description: 'Administración del equipo de estilistas.',
    descriptionKey: 'admin.section.barbers.description',
  },
  {
    key: 'subscriptions',
    label: 'Suscripciones',
    labelKey: 'admin.section.subscriptions.label',
    description: 'Planes de suscripción para clientes y asignación por local.',
    descriptionKey: 'admin.section.subscriptions.description',
  },
  {
    key: 'loyalty',
    label: 'Fidelización',
    labelKey: 'admin.section.loyalty.label',
    description: 'Tarjetas de fidelización y recompensas para clientes.',
    descriptionKey: 'admin.section.loyalty.description',
  },
  {
    key: 'referrals',
    label: 'Referidos',
    labelKey: 'admin.section.referrals.label',
    description: 'Programa de referidos, recompensas y atribuciones.',
    descriptionKey: 'admin.section.referrals.description',
  },
  {
    key: 'reviews',
    label: 'Reseñas',
    labelKey: 'admin.section.reviews.label',
    description: 'Solicitudes in-app para reseñas y feedback privado.',
    descriptionKey: 'admin.section.reviews.description',
  },
  {
    key: 'alerts',
    label: 'Alertas',
    labelKey: 'admin.section.alerts.label',
    description: 'Mensajes destacados o avisos para clientes.',
    descriptionKey: 'admin.section.alerts.description',
  },
  {
    key: 'holidays',
    label: 'Festivos',
    labelKey: 'admin.section.holidays.label',
    description: 'Bloqueo de días no laborables generales o por profesional.',
    descriptionKey: 'admin.section.holidays.description',
  },
  {
    key: 'roles',
    label: 'Roles y permisos',
    labelKey: 'admin.section.roles.label',
    description: 'Configuración de roles administrativos y accesos.',
    descriptionKey: 'admin.section.roles.description',
  },
  {
    key: 'settings',
    label: 'Configuración',
    labelKey: 'admin.section.settings.label',
    description: 'Datos generales, redes y horario de apertura.',
    descriptionKey: 'admin.section.settings.description',
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
  section: AdminSectionDefinition,
  copy?: BusinessCopy | null,
  translate?: AdminSectionTranslator,
) => {
  if (!copy) {
    return translate ? translate(section.labelKey) : section.label;
  }
  if (section.key === 'barbers') return copy.staff.plural;
  if (translate) return translate(section.labelKey);
  return section.label;
};

export const resolveAdminSectionDescription = (
  section: AdminSectionDefinition,
  copy?: BusinessCopy | null,
  translate?: AdminSectionTranslator,
) => {
  if (translate) {
    if (!copy) return translate(section.descriptionKey);
    switch (section.key) {
      case 'search':
        return translate(section.descriptionKey, { staffSingularLower: copy.staff.singularLower });
      case 'services':
        return translate(section.descriptionKey, { locationDefiniteSingular: copy.location.definiteSingular });
      case 'barbers':
        return translate(section.descriptionKey, { staffFromWithDefinitePlural: copy.staff.fromWithDefinitePlural });
      case 'holidays':
        return translate(section.descriptionKey, { staffSingularLower: copy.staff.singularLower });
      default:
        return translate(section.descriptionKey);
    }
  }
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

export const getAdminSections = (copy?: BusinessCopy | null, translate?: AdminSectionTranslator) =>
  ADMIN_SECTIONS.map((section) => ({
    ...section,
    label: resolveAdminSectionLabel(section, copy, translate),
    description: resolveAdminSectionDescription(section, copy, translate),
  }));
