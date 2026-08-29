import { Calendar, LayoutDashboard, Repeat, User, Users, type LucideIcon } from 'lucide-react';

export type ClientNavItem = {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  exact?: boolean;
};

export const CLIENT_NAV_ITEMS: ClientNavItem[] = [
  { href: '/app', labelKey: 'clientNav.dashboard', icon: LayoutDashboard, exact: true },
  { href: '/app/appointments', labelKey: 'clientNav.appointments', icon: Calendar },
  { href: '/app/subscriptions', labelKey: 'clientNav.subscriptions', icon: Repeat },
  { href: '/app/referrals', labelKey: 'clientNav.referrals', icon: Users },
  { href: '/app/profile', labelKey: 'clientNav.profile', icon: User },
];
