import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import { cn } from '@/lib/utils';
import AdminSpotlight from '@/components/admin/AdminSpotlight';
import AdminSpotlightTrigger from '@/components/admin/AdminSpotlightTrigger';
import { AdminPermissionsProvider, useAdminPermissions } from '@/context/AdminPermissionsContext';
import { useTenant } from '@/context/TenantContext';
import { Button } from '@/components/ui/button';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { AdminSpotlightProvider } from '@/components/admin/AdminSpotlightContext';
import { useI18n } from '@/hooks/useI18n';

const AiAssistantFloatingButton = lazy(() => import('@/components/admin/AiAssistantFloatingButton'));
const QuickAppointmentButton = lazy(() => import('@/components/admin/QuickAppointmentButton'));

const AdminLayoutContent: React.FC = () => {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(max-width: 767px)').matches;
  });
  const { canAccessSection } = useAdminPermissions();
  const { tenant } = useTenant();
  const { t } = useI18n();

  const showFloatingActions =
    canAccessSection('calendar') ||
    canAccessSection('search') ||
    canAccessSection('clients');
  const spotlightFloatingEnabled =
    tenant?.config?.branding?.adminSpotlightFloatingEnabled !== false;
  const assistantFloatingEnabled =
    tenant?.config?.branding?.adminAssistantFloatingEnabled !== false;

  useEffect(() => {
    document.body.classList.add('admin-route-active');
    return () => {
      document.body.classList.remove('admin-route-active');
    };
  }, []);

  return (
    <div className="admin-layout-shell min-h-screen bg-background">
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'fixed top-4 z-[45] md:hidden transition-all duration-300',
          collapsed ? 'left-[.8rem]' : 'left-[16.5rem] -translate-x-1/2'
        )}
        onClick={() => setCollapsed((prev) => !prev)}
        aria-label={collapsed ? t('admin.layout.openMenu') : t('admin.layout.closeMenu')}
      >
        {collapsed ? <ChevronsRight className="h-5 w-5" /> : <ChevronsLeft className="h-5 w-5" />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'fixed top-4 z-[45] hidden md:inline-flex transition-all duration-300',
          collapsed ? 'left-20 -translate-x-1/2' : 'left-64 -translate-x-1/2'
        )}
        onClick={() => setCollapsed((prev) => !prev)}
        aria-label={collapsed ? t('admin.layout.expandSidebar') : t('admin.layout.collapseSidebar')}
      >
        {collapsed ? <ChevronsRight className="h-5 w-5" /> : <ChevronsLeft className="h-5 w-5" />}
      </Button>
      {!collapsed && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setCollapsed(true)}
          aria-hidden="true"
        />
      )}
      <AdminSidebar collapsed={collapsed} onToggle={() => setCollapsed((prev) => !prev)} />
      {spotlightFloatingEnabled && <AdminSpotlight />}
      <main
          className={cn(
          'admin-layout-main p-3 !pt-6 sm:p-6 sm:pt-6 md:p-8 transition-all duration-300 ml-0',
          collapsed ? 'md:ml-20' : 'md:ml-64'
        )}
      >
        <Outlet />
      </main>
      {showFloatingActions && (
        <>
          {spotlightFloatingEnabled && (
            <AdminSpotlightTrigger className={!assistantFloatingEnabled ? 'bottom-24' : undefined} />
          )}
          <Suspense fallback={null}>
            {assistantFloatingEnabled && <AiAssistantFloatingButton />}
            <QuickAppointmentButton />
          </Suspense>
        </>
      )}
    </div>
  );
};

const AdminLayout: React.FC = () => (
  <AdminPermissionsProvider>
    <AdminSpotlightProvider>
      <AdminLayoutContent />
    </AdminSpotlightProvider>
  </AdminPermissionsProvider>
);

export default AdminLayout;
