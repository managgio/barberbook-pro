import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import { cn } from '@/lib/utils';
import QuickAppointmentButton from '@/components/admin/QuickAppointmentButton';

const AdminLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);

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
      <QuickAppointmentButton />
    </div>
  );
};

export default AdminLayout;
