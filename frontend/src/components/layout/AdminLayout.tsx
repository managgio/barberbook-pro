import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import { cn } from '@/lib/utils';
import AiAssistantFloatingButton from '@/components/admin/AiAssistantFloatingButton';
import QuickAppointmentButton from '@/components/admin/QuickAppointmentButton';
import { AdminPermissionsProvider, useAdminPermissions } from '@/context/AdminPermissionsContext';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';

const AdminLayoutContent: React.FC = () => {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(max-width: 767px)').matches;
  });
  const { canAccessSection } = useAdminPermissions();

  const showFloatingActions =
    canAccessSection('calendar') ||
    canAccessSection('search') ||
    canAccessSection('clients');

  return (
    <div className="min-h-screen bg-background">
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'fixed top-4 z-50 md:hidden transition-all duration-300',
          collapsed ? 'left-4' : 'left-64 -translate-x-1/2'
        )}
        onClick={() => setCollapsed((prev) => !prev)}
        aria-label={collapsed ? 'Abrir menú' : 'Cerrar menú'}
      >
        {collapsed ? <Menu className="h-5 w-5" /> : <X className="h-5 w-5" />}
      </Button>
      {!collapsed && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setCollapsed(true)}
          aria-hidden="true"
        />
      )}
      <AdminSidebar collapsed={collapsed} onToggle={() => setCollapsed((prev) => !prev)} />
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
          <AiAssistantFloatingButton />
          <QuickAppointmentButton />
        </>
      )}
    </div>
  );
};

const AdminLayout: React.FC = () => (
  <AdminPermissionsProvider>
    <AdminLayoutContent />
  </AdminPermissionsProvider>
);

export default AdminLayout;
