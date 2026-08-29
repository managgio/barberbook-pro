import React, { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useTenant } from '@/context/TenantContext';
import Navbar from './Navbar';
import LegalFooter from './LegalFooter';
import { getReferralSummary } from '@/data/api/referrals';
import ReviewPromptModal from '@/components/reviews/ReviewPromptModal';
import { useI18n } from '@/hooks/useI18n';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import ClientNavigationBar from './ClientNavigationBar';
import { CLIENT_NAV_ITEMS } from './clientNavItems';

const ClientLayout: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { t } = useI18n();
  const { settings, isLoading: isLoadingSettings } = useSiteSettings();
  const [referralsEnabled, setReferralsEnabled] = useState<boolean | null>(null);
  const subscriptionsEnabled = !tenant?.config?.adminSidebar?.hiddenSections?.includes('subscriptions');
  const requiresPhoneCompletion = Boolean(
    !isLoadingSettings &&
      user &&
      settings.profile?.phoneRequired === true &&
      !(user.phone || '').trim(),
  );

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
    if (referralsEnabled === false && !subscriptionsEnabled) {
      return CLIENT_NAV_ITEMS.filter(
        (item) => item.href !== '/app/referrals' && item.href !== '/app/subscriptions',
      );
    }
    if (referralsEnabled === false) {
      return CLIENT_NAV_ITEMS.filter((item) => item.href !== '/app/referrals');
    }
    if (!subscriptionsEnabled) {
      return CLIENT_NAV_ITEMS.filter((item) => item.href !== '/app/subscriptions');
    }
    return CLIENT_NAV_ITEMS;
  }, [referralsEnabled, subscriptionsEnabled]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-16">
        <ClientNavigationBar
          items={visibleNavItems}
          pathname={location.pathname}
          translate={t}
        />

        {/* Page Content */}
        <main className="container mx-auto px-4 py-4 sm:py-8">
          <Outlet />
        </main>
      </div>
      {!requiresPhoneCompletion && <ReviewPromptModal />}
      <LegalFooter />
    </div>
  );
};

export default ClientLayout;
