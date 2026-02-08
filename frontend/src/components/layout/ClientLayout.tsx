import React, { useEffect, useMemo, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import Navbar from './Navbar';
import LegalFooter from './LegalFooter';
import { Calendar, User, LayoutDashboard, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getReferralSummary } from '@/data/api/referrals';
import ReviewPromptModal from '@/components/reviews/ReviewPromptModal';

const clientNavItems = [
  { href: '/app', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/app/appointments', label: 'Mis Citas', icon: Calendar },
  { href: '/app/referrals', label: 'Invita y gana', icon: Users },
  { href: '/app/profile', label: 'Mi Perfil', icon: User },
];

const ClientLayout: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [referralsEnabled, setReferralsEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    getReferralSummary(user.id)
      .then((data) => {
        if (!active) return;
        setReferralsEnabled(data.programEnabled !== false);
      })
      .catch(() => {
        if (!active) return;
        setReferralsEnabled(null);
      });
    return () => {
      active = false;
    };
  }, [user?.id]);

  const visibleNavItems = useMemo(() => {
    if (referralsEnabled === false) {
      return clientNavItems.filter((item) => item.href !== '/app/referrals');
    }
    return clientNavItems;
  }, [referralsEnabled]);

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
            <div className="scrollbar-none flex items-center gap-1.5 sm:gap-2 py-2 sm:py-3 overflow-x-auto">
              {visibleNavItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    'flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-[11px] sm:text-sm font-medium whitespace-nowrap transition-all duration-200',
                    isActive(item.href, item.exact)
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  )}
                >
                  <item.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Page Content */}
        <main className="container mx-auto px-4 py-4 sm:py-8">
          <Outlet />
        </main>
      </div>
      <ReviewPromptModal />
      <LegalFooter />
    </div>
  );
};

export default ClientLayout;
