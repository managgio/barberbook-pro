import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import Navbar from './Navbar';
import { Calendar, User, LayoutDashboard, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const clientNavItems = [
  { href: '/app', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/app/appointments', label: 'Mis Citas', icon: Calendar },
  { href: '/app/profile', label: 'Mi Perfil', icon: User },
];

const ClientLayout: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();

  const isActive = (path: string, exact?: boolean) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-16">
        {/* Client Navigation Bar */}
        <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-16 z-30">
          <div className="container mx-auto px-4">
            <div className="flex items-center gap-2 py-3 overflow-x-auto">
              {clientNavItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200',
                    isActive(item.href, item.exact)
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Page Content */}
        <main className="container mx-auto px-4 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default ClientLayout;
