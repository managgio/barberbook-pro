import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { User, LogOut } from 'lucide-react';
import leBlondLogo from '@/assets/img/leBlongLogo-2.png';

const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <img
              src={leBlondLogo}
              alt="Le Blond Hair Salon logo"
              className="w-10 h-10 object-contain rounded-lg shadow-sm transition-transform group-hover:scale-105"
            />
            <span className="text-xl font-bold text-foreground">Le Blond</span>
          </Link>

          {/* Auth Section */}
          <div className="flex items-center gap-3">
            {isAuthenticated && user ? (
              <>
                <div className="flex items-center gap-2 pl-[.3rem] pr-3 py-1 rounded-full border border-primary/20 bg-primary/5">
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
