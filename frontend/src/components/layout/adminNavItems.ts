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
} from 'lucide-react';
import { AdminSectionKey } from '@/data/types';

export type AdminNavItem = {
  href: string;
  label: string;
  icon: ElementType;
  section: AdminSectionKey;
  keywords?: string[];
};

export const adminNavItems: AdminNavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, section: 'dashboard', keywords: ['resumen', 'inicio'] },
  { href: '/admin/calendar', label: 'Calendario', icon: Calendar, section: 'calendar', keywords: ['agenda', 'citas'] },
  { href: '/admin/search', label: 'Buscar Citas', icon: Search, section: 'search', keywords: ['busqueda', 'clientes'] },
  { href: '/admin/clients', label: 'Clientes', icon: Users, section: 'clients', keywords: ['usuarios'] },
  { href: '/admin/cash-register', label: 'Caja Registradora', icon: Wallet, section: 'cash-register', keywords: ['ventas', 'caja'] },
  { href: '/admin/stock', label: 'Control de stock', icon: Boxes, section: 'stock', keywords: ['inventario', 'productos'] },
  { href: '/admin/services', label: 'Servicios', icon: Scissors, section: 'services', keywords: ['prestaciones'] },
  { href: '/admin/barbers', label: 'Barberos', icon: UserCircle, section: 'barbers', keywords: ['staff', 'equipo'] },
  { href: '/admin/loyalty', label: 'Fidelización', icon: Award, section: 'loyalty', keywords: ['puntos', 'recompensas'] },
  { href: '/admin/referrals', label: 'Referidos', icon: UserPlus, section: 'referrals', keywords: ['invitaciones'] },
  { href: '/admin/reviews', label: 'Reseñas', icon: Star, section: 'reviews', keywords: ['ratings', 'opiniones'] },
  { href: '/admin/alerts', label: 'Alertas', icon: Bell, section: 'alerts', keywords: ['avisos'] },
  { href: '/admin/offers', label: 'Ofertas', icon: Tag, section: 'offers', keywords: ['descuentos', 'promos'] },
  { href: '/admin/holidays', label: 'Festivos', icon: CalendarDays, section: 'holidays', keywords: ['cierres'] },
  { href: '/admin/settings', label: 'Configuración', icon: Settings, section: 'settings', keywords: ['ajustes'] },
  { href: '/admin/roles', label: 'Roles', icon: Shield, section: 'roles', keywords: ['permisos'] },
];
