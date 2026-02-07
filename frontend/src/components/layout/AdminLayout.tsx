import React, { lazy, Suspense, useState } from 'react';
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

const AiAssistantFloatingButton = lazy(() => import('@/components/admin/AiAssistantFloatingButton'));
const QuickAppointmentButton = lazy(() => import('@/components/admin/QuickAppointmentButton'));

const AdminLayoutContent: React.FC = () => {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(max-width: 767px)').matches;
  });
  const { canAccessSection } = useAdminPermissions();
  const { tenant } = useTenant();

  const showFloatingActions =
    canAccessSection('calendar') ||
    canAccessSection('search') ||
    canAccessSection('clients');
  const spotlightFloatingEnabled =
    tenant?.config?.branding?.adminSpotlightFloatingEnabled !== false;
  const assistantFloatingEnabled =
    tenant?.config?.branding?.adminAssistantFloatingEnabled !== false;

  return (
    <div className="min-h-screen bg-background">
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'fixed top-4 z-[1000] md:hidden transition-all duration-300',
          collapsed ? 'left-4' : 'left-64 -translate-x-1/2'
        )}
        onClick={() => setCollapsed((prev) => !prev)}
        aria-label={collapsed ? 'Abrir menú' : 'Cerrar menú'}
      >
        {collapsed ? <ChevronsRight className="h-5 w-5" /> : <ChevronsLeft className="h-5 w-5" />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'fixed top-4 z-[1000] hidden md:inline-flex transition-all duration-300',
          collapsed ? 'left-20 -translate-x-1/2' : 'left-64 -translate-x-1/2'
        )}
        onClick={() => setCollapsed((prev) => !prev)}
        aria-label={collapsed ? 'Expandir sidebar' : 'Contraer sidebar'}
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
      <AdminSpotlight />
      <main
        className={cn(
          'p-4 sm:p-6 md:p-8 transition-all duration-300 ml-0',
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
