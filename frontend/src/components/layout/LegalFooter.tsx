import React from 'react';
import { Link } from 'react-router-dom';
import { useSiteSettings } from '@/hooks/useSiteSettings';

const LegalFooter: React.FC = () => {
  const { settings } = useSiteSettings();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border/60 py-4 sm:py-6">
      <div className="container px-4 flex flex-col gap-2 sm:gap-3 md:flex-row md:items-center md:justify-between text-xs sm:text-sm text-muted-foreground">
        <span className="leading-tight sm:leading-normal">(c) {year} {settings.branding.name}. Todos los derechos reservados.</span>
        <div className="flex flex-wrap gap-3 sm:gap-4 text-xs sm:text-sm">
          <Link to="/legal/notice" className="hover:text-primary transition-colors">Aviso legal</Link>
          <Link to="/legal/privacy" className="hover:text-primary transition-colors">Privacidad</Link>
          <Link to="/legal/cookies" className="hover:text-primary transition-colors">Cookies</Link>
        </div>
      </div>
    </footer>
  );
};

export default LegalFooter;
