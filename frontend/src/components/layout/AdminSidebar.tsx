import React, { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { UserCircle, LogOut, ChevronLeft, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useAdminPermissions } from '@/context/AdminPermissionsContext';
import LocationSwitcher from '@/components/common/LocationSwitcher';
import { useTenant } from '@/context/TenantContext';
import { resolveBrandLogo } from '@/lib/branding';
import { useBusinessCopy } from '@/lib/businessCopy';
import { adminNavItems, resolveAdminNavItemLabel, sortAdminNavItems } from './adminNavItems';


interface AdminSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({ collapsed, onToggle }) => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { settings } = useSiteSettings();
  const { tenant } = useTenant();
  const copy = useBusinessCopy();
  const leBlondLogo = '/leBlondLogo.png';
  const logoUrl = resolveBrandLogo(tenant, leBlondLogo);
  const { isLoading, canAccessSection } = useAdminPermissions();

  const shouldAutoClose = () =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;

  const handleNavClick = () => {
    if (!collapsed && shouldAutoClose()) {
      onToggle();
    }
  };

  const isActive = (path: string) => {
    if (path === '/admin') return location.pathname === '/admin';
    return location.pathname.startsWith(path);
  };

  const visibleNavItems = useMemo(
    () => sortAdminNavItems(adminNavItems.filter((item) => canAccessSection(item.section)), settings.adminSidebar?.order),
    [canAccessSection, settings.adminSidebar?.order],
  );
  const showNoAccessMessage =
    user?.role === 'admin' &&
    !user?.isSuperAdmin &&
    !user?.isPlatformAdmin &&
    (!user?.adminRoleId || visibleNavItems.length === 0) &&
    !isLoading;

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 h-[100dvh] bg-sidebar border-r border-sidebar-border flex flex-col overflow-hidden z-40 w-64 transform transition-all duration-300',
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
            src={logoUrl}
            alt={`${settings.branding.shortName} logo`}
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
          className="sr-only"
          onClick={onToggle}
        >
          {collapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
        </Button>
      </div>
      {!collapsed && (
        <div className="px-4 pt-3">
          <LocationSwitcher compact className="w-full" />
        </div>
      )}

      {/* Navigation */}
      <nav className={cn('flex-1 min-h-0 p-4 space-y-1 overflow-y-auto overflow-x-visible', collapsed && 'px-2')}>
        {isLoading && !user?.isSuperAdmin && !user?.isPlatformAdmin && (
          <p className="text-xs text-muted-foreground px-2">Cargando accesos...</p>
        )}
        {showNoAccessMessage && (
          <p className="text-xs text-muted-foreground px-2">
            No tienes permisos asignados. Contacta con el superadmin.
          </p>
        )}
        {visibleNavItems.map((item) => {
          const label = resolveAdminNavItemLabel(item, copy);
          const link = (
            <Link
              to={item.href}
              onClick={handleNavClick}
              className={cn(
                'group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                isActive(item.href)
                  ? 'bg-sidebar-accent text-primary'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                collapsed && 'justify-center'
              )}
            >
              <item.icon className="w-5 h-5" />
              {!collapsed && label}
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
                {label}
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
