import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  Calendar,
  Search,
  Users,
  Scissors,
  UserCircle,
  Bell,
  LayoutDashboard,
  LogOut,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  CalendarDays,
  Shield,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import leBlondLogo from '@/assets/img/leBlongLogo-2.png';
import { AdminSectionKey } from '@/data/types';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useAdminPermissions } from '@/context/AdminPermissionsContext';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  section: AdminSectionKey;
}

const navItems: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, section: 'dashboard' },
  { href: '/admin/calendar', label: 'Calendario', icon: Calendar, section: 'calendar' },
  { href: '/admin/search', label: 'Buscar Citas', icon: Search, section: 'search' },
  { href: '/admin/clients', label: 'Clientes', icon: Users, section: 'clients' },
  { href: '/admin/services', label: 'Servicios', icon: Scissors, section: 'services' },
  { href: '/admin/barbers', label: 'Barberos', icon: UserCircle, section: 'barbers' },
  { href: '/admin/alerts', label: 'Alertas', icon: Bell, section: 'alerts' },
  { href: '/admin/holidays', label: 'Festivos', icon: CalendarDays, section: 'holidays' },
  { href: '/admin/settings', label: 'Configuración', icon: Settings, section: 'settings' },
  { href: '/admin/roles', label: 'Roles', icon: Shield, section: 'roles' },
];

interface AdminSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({ collapsed, onToggle }) => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { settings } = useSiteSettings();
  const { isLoading, canAccessSection } = useAdminPermissions();

  const isActive = (path: string) => {
    if (path === '/admin') return location.pathname === '/admin';
    return location.pathname.startsWith(path);
  };

  const visibleNavItems = navItems.filter((item) => canAccessSection(item.section));
  const showNoAccessMessage =
    user?.role === 'admin' && !user?.isSuperAdmin && (!user?.adminRoleId || visibleNavItems.length === 0) && !isLoading;

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 bg-sidebar border-r border-sidebar-border flex flex-col z-40 w-64 transform transition-all duration-300',
        collapsed ? '-translate-x-full md:translate-x-0 md:w-20' : 'translate-x-0 md:w-64'
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'border-b border-sidebar-border flex items-center relative',
          collapsed ? 'justify-center p-4' : 'p-4'
        )}
      >
        <Link to="/" className={cn('flex items-center gap-3 group', collapsed && 'justify-center')}>
          <img
            src={leBlondLogo}
            alt="Le Blond Hair Salon logo"
            className="w-10 h-10 rounded-lg object-contain shadow-sm"
          />
          {!collapsed && (
            <div>
              <span className="text-lg font-bold text-sidebar-foreground">{settings.branding.shortName}</span>
              <span className="block text-xs text-muted-foreground">Panel Admin</span>
            </div>
          )}
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'hidden md:inline-flex transition-all duration-300',
            collapsed ? 'absolute top-3 -right-5' : 'absolute top-4 -right-4 bg-background shadow-lg border rounded-full'
          )}
          onClick={onToggle}
        >
          {collapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className={cn('flex-1 p-4 space-y-1 overflow-y-auto overflow-x-visible', collapsed && 'px-2')}>
        {isLoading && !user?.isSuperAdmin && (
          <p className="text-xs text-muted-foreground px-2">Cargando accesos...</p>
        )}
        {showNoAccessMessage && (
          <p className="text-xs text-muted-foreground px-2">
            No tienes permisos asignados. Contacta con el superadmin.
          </p>
        )}
        {(user?.isSuperAdmin ? navItems : visibleNavItems).map((item) => {
          const link = (
            <Link
              to={item.href}
              className={cn(
                'group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                isActive(item.href)
                  ? 'bg-sidebar-accent text-primary'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                collapsed && 'justify-center'
              )}
            >
              <item.icon className="w-5 h-5" />
              {!collapsed && item.label}
            </Link>
          );

          if (!collapsed) {
            return (
              <React.Fragment key={item.href}>
                {link}
              </React.Fragment>
            );
          }

          return (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right" align="center" className="text-xs">
                {item.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-sidebar-border">
        <div className={cn('flex items-center gap-3 mb-3', collapsed && 'justify-center')}>
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <UserCircle className="w-5 h-5 text-primary" />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {user?.name}
              </p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          )}
        </div>
        <div className={cn('flex gap-2', collapsed && 'flex-col')}>
          <Button
            variant="ghost"
            size="sm"
            className={cn('flex-1', collapsed && 'px-0 justify-center')}
            asChild
          >
            <Link to="/">
              <ChevronLeft className="w-4 h-4 mr-1" />
              {!collapsed && 'Volver'}
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className={cn(collapsed && 'px-0 justify-center')}
          >
            <LogOut className="w-4 h-4" />
            {!collapsed && <span className="ml-1">Salir</span>}
          </Button>
        </div>
      </div>
    </aside>
  );
};

export default AdminSidebar;
