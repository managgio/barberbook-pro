import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { User, LogOut } from 'lucide-react';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import LocationSwitcher from '@/components/common/LocationSwitcher';
import { useTenant } from '@/context/TenantContext';
import { cn } from '@/lib/utils';

const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { settings } = useSiteSettings();
  const { tenant, locations } = useTenant();
  const location = useLocation();
  const leBlondLogo = '/leBlondLogo.png';
  const logoUrl = tenant?.config?.branding?.logoUrl || leBlondLogo;
  const isLanding = location.pathname === '/';
  const hasMultipleLocations = locations.length > 1;
  const brandNameClass = cn(
    'text-xl font-bold text-foreground',
    isLanding && hasMultipleLocations ? 'hidden sm:inline' : 'inline'
  );
  const userBadgeClass = cn(
    'flex items-center gap-2 pl-[.3rem] pr-3 py-1 rounded-full border border-primary/20 bg-primary/5',
    isLanding && hasMultipleLocations ? 'hidden sm:flex' : 'flex'
  );

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <img
              src={logoUrl}
              alt={`${settings.branding.shortName} logo`}
              className="w-10 h-10 object-contain rounded-lg shadow-sm transition-transform group-hover:scale-105"
            />
            <span className={brandNameClass}>{settings.branding.shortName}</span>
          </Link>

          {/* Auth Section */}
          <div className="flex items-center gap-3">
            <LocationSwitcher />
            {isAuthenticated && user ? (
              <>
                <div className={userBadgeClass}>
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{user.name}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={logout} className="flex items-center gap-2">
                  <LogOut className="w-4 h-4" />
                  <span>Salir</span>
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link to="/auth">Iniciar sesión</Link>
                </Button>
                <Button asChild>
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
