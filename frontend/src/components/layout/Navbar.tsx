import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { User, LogOut } from 'lucide-react';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import LocationSwitcher from '@/components/common/LocationSwitcher';
import { useTenant } from '@/context/TenantContext';
import { cn } from '@/lib/utils';
import { resolveBrandLogo } from '@/lib/branding';

const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { settings } = useSiteSettings();
  const { tenant, locations } = useTenant();
  const location = useLocation();
  const leBlondLogo = '/leBlondLogo.png';
  const logoUrl = resolveBrandLogo(tenant, leBlondLogo);
  const isLanding = location.pathname === '/';
  const isClientApp = location.pathname.startsWith('/app');
  const isGuestBookRoute = location.pathname === '/book' || location.pathname.startsWith('/book/');
  const hasMultipleLocations = locations.length > 1;
  const showUserNameOnMobile = !hasMultipleLocations;
  const isAdmin =
    user?.role === 'admin' || user?.isLocalAdmin || user?.isSuperAdmin;
  const userTarget = tenant?.isPlatform
    ? '/platform'
    : isAdmin
      ? '/admin'
      : '/app/profile';
  const brandNameClass = cn(
    'text-xl font-bold text-foreground',
    isLanding || isClientApp || isGuestBookRoute ? 'hidden sm:inline' : 'inline'
  );
  const userBadgeClass = cn(
    'flex items-center justify-center rounded-full border border-primary/20 bg-primary/5 transition-colors hover:border-primary/40 hover:bg-primary/10',
    showUserNameOnMobile
      ? 'h-8 px-2.5 gap-1.5 sm:h-auto sm:w-auto sm:gap-2 sm:px-2 sm:py-1'
      : 'h-8 w-8 p-0 sm:h-auto sm:w-auto sm:gap-2 sm:px-2 sm:py-1',
    isLanding && hasMultipleLocations ? 'hidden sm:flex' : 'flex'
  );

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group shrink-0 min-w-[2.5rem]">
            <img
              src={logoUrl}
              alt={`${settings.branding.shortName} logo`}
              loading="eager"
              decoding="async"
              width={40}
              height={40}
              className="w-10 h-10 object-contain rounded-lg shadow-sm transition-transform group-hover:scale-105 shrink-0"
            />
            <span className={brandNameClass}>{settings.branding.shortName}</span>
          </Link>

          {/* Auth Section */}
          <div className="flex items-center gap-2 sm:gap-3">
            <LocationSwitcher compact className={isGuestBookRoute ? 'hidden sm:inline-flex' : undefined} />
            {isAuthenticated && user ? (
              <>
                <Link to={userTarget} className={userBadgeClass}>
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center sm:w-8 sm:h-8">
                    <User className="w-3.5 h-3.5 text-primary sm:w-4 sm:h-4" />
                  </div>
                  <span
                    className={cn(
                      'font-medium text-foreground',
                      showUserNameOnMobile ? 'inline text-xs sm:text-sm' : 'hidden sm:inline text-sm'
                    )}
                  >
                    {user.name}
                  </span>
                </Link>
                <Button variant="ghost" size="sm" onClick={logout} className="flex items-center gap-2">
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Salir</span>
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" className="h-8 px-2 text-xs sm:h-9 sm:px-3 sm:text-sm" asChild>
                  <Link to="/auth">Iniciar sesión</Link>
                </Button>
                <Button className="hidden sm:inline-flex" asChild>
                  <Link to="/auth?tab=signup">Reservar</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
