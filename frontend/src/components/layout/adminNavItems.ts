import type { ElementType } from 'react';
import {
  Calendar,
  Search,
  Users,
  UserPlus,
  Scissors,
  UserCircle,
  Bell,
  LayoutDashboard,
  CalendarDays,
  Shield,
  Settings,
  Wallet,
  Tag,
  Boxes,
  Award,
  Star,
  Repeat,
  Megaphone,
  MailWarning,
} from 'lucide-react';
import { AdminSectionKey } from '@/data/types';
import { getAdminSectionDefinition } from '@/data/adminSections';
import type { BusinessCopy } from '@/lib/businessCopy';

export type AdminNavItem = {
  href: string;
  label: string;
  labelKey: string;
  icon: ElementType;
  section: AdminSectionKey;
  keywords?: string[];
};

type AdminNavItemDefinition = Omit<AdminNavItem, 'label' | 'labelKey'>;

const ADMIN_NAV_ITEM_DEFINITIONS: AdminNavItemDefinition[] = [
  { href: '/admin', icon: LayoutDashboard, section: 'dashboard', keywords: ['resumen', 'inicio'] },
  { href: '/admin/calendar', icon: Calendar, section: 'calendar', keywords: ['agenda', 'citas'] },
  { href: '/admin/search', icon: Search, section: 'search', keywords: ['busqueda', 'clientes'] },
  { href: '/admin/clients', icon: Users, section: 'clients', keywords: ['usuarios'] },
  { href: '/admin/cash-register', icon: Wallet, section: 'cash-register', keywords: ['ventas', 'caja'] },
  { href: '/admin/stock', icon: Boxes, section: 'stock', keywords: ['inventario', 'productos'] },
  { href: '/admin/services', icon: Scissors, section: 'services', keywords: ['prestaciones'] },
  { href: '/admin/barbers', icon: UserCircle, section: 'barbers', keywords: ['staff', 'equipo'] },
  { href: '/admin/subscriptions', icon: Repeat, section: 'subscriptions', keywords: ['planes', 'mensual'] },
  { href: '/admin/loyalty', icon: Award, section: 'loyalty', keywords: ['puntos', 'recompensas'] },
  { href: '/admin/referrals', icon: UserPlus, section: 'referrals', keywords: ['invitaciones'] },
  { href: '/admin/reviews', icon: Star, section: 'reviews', keywords: ['ratings', 'opiniones'] },
  { href: '/admin/alerts', icon: Bell, section: 'alerts', keywords: ['avisos'] },
  { href: '/admin/communications', icon: Megaphone, section: 'communications', keywords: ['mensajes', 'cancelaciones'] },
  { href: '/admin/deliveries', icon: MailWarning, section: 'email-deliveries', keywords: ['email', 'sms', 'whatsapp', 'entregas', 'errores'] },
  { href: '/admin/offers', icon: Tag, section: 'offers', keywords: ['descuentos', 'promos'] },
  { href: '/admin/holidays', icon: CalendarDays, section: 'holidays', keywords: ['cierres'] },
  { href: '/admin/settings', icon: Settings, section: 'settings', keywords: ['ajustes'] },
  { href: '/admin/roles', icon: Shield, section: 'roles', keywords: ['permisos'] },
];

export const adminNavItems: AdminNavItem[] = ADMIN_NAV_ITEM_DEFINITIONS.map((item) => {
  const section = getAdminSectionDefinition(item.section);
  return {
    ...item,
    label: section.label,
    labelKey: section.labelKey,
  };
});

export const resolveAdminNavItemLabel = (
  item: AdminNavItem,
  copy?: BusinessCopy | null,
  translate?: (key: string) => string,
) => {
  if (item.section === 'barbers' && copy) return copy.staff.plural;
  if (translate) return translate(item.labelKey);
  return item.label;
};

export const ADMIN_NAV_DEFAULT_ORDER: AdminSectionKey[] = adminNavItems.map((item) => item.section);
const ADMIN_NAV_DEFAULT_INDEX = new Map(ADMIN_NAV_DEFAULT_ORDER.map((section, index) => [section, index]));
const ADMIN_NAV_SECTION_SET = new Set(ADMIN_NAV_DEFAULT_ORDER);

export const normalizeAdminNavOrder = (order?: string[] | null): AdminSectionKey[] => {
  if (!Array.isArray(order)) return [];
  const seen = new Set<string>();
  return order.filter((section): section is AdminSectionKey => {
    const key = section as AdminSectionKey;
    if (!ADMIN_NAV_SECTION_SET.has(key)) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const resolveAdminNavOrder = (order?: string[] | null): AdminSectionKey[] => {
  const configured = normalizeAdminNavOrder(order);
  const missingSections = ADMIN_NAV_DEFAULT_ORDER.filter((section) => !configured.includes(section));
  const nextOrder = [...configured, ...missingSections];
  if (!nextOrder.includes('subscriptions')) return nextOrder;
  const subscriptionsIndex = nextOrder.indexOf('subscriptions');
  const loyaltyIndex = nextOrder.indexOf('loyalty');
  if (loyaltyIndex === -1 || subscriptionsIndex < loyaltyIndex) return nextOrder;
  nextOrder.splice(subscriptionsIndex, 1);
  nextOrder.splice(loyaltyIndex, 0, 'subscriptions');
  return nextOrder;
};

export const sortAdminNavItems = <T extends AdminNavItem>(items: T[], order?: string[] | null): T[] => {
  const resolvedOrder = resolveAdminNavOrder(order);
  const resolvedIndex = new Map(resolvedOrder.map((section, index) => [section, index]));
  return [...items].sort((a, b) => {
    const rankA = resolvedIndex.get(a.section) ?? Number.MAX_SAFE_INTEGER;
    const rankB = resolvedIndex.get(b.section) ?? Number.MAX_SAFE_INTEGER;
    if (rankA !== rankB) return rankA - rankB;
    return (ADMIN_NAV_DEFAULT_INDEX.get(a.section) ?? 0) - (ADMIN_NAV_DEFAULT_INDEX.get(b.section) ?? 0);
  });
};
