import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import { cn } from '@/lib/utils';
import AiAssistantFloatingButton from '@/components/admin/AiAssistantFloatingButton';
import QuickAppointmentButton from '@/components/admin/QuickAppointmentButton';
import { AdminPermissionsProvider, useAdminPermissions } from '@/context/AdminPermissionsContext';

const AdminLayoutContent: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { canAccessSection } = useAdminPermissions();

  const showFloatingActions =
    canAccessSection('calendar') ||
    canAccessSection('search') ||
    canAccessSection('clients');

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar collapsed={collapsed} onToggle={() => setCollapsed((prev) => !prev)} />
      <main
        className={cn(
          'p-6 md:p-8 transition-all duration-300',
          collapsed ? 'ml-20' : 'ml-64'
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
