import React from 'react';
import { Link } from 'react-router-dom';
import { useSiteSettings } from '@/hooks/useSiteSettings';

const LegalFooter: React.FC = () => {
  const { settings } = useSiteSettings();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border/60 py-6">
      <div className="container px-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between text-sm text-muted-foreground">
        <span>(c) {year} {settings.branding.name}. Todos los derechos reservados.</span>
        <div className="flex flex-wrap gap-4">
          <Link to="/legal/notice" className="hover:text-primary transition-colors">Aviso legal</Link>
          <Link to="/legal/privacy" className="hover:text-primary transition-colors">Privacidad</Link>
          <Link to="/legal/cookies" className="hover:text-primary transition-colors">Cookies</Link>
        </div>
      </div>
    </footer>
  );
};

export default LegalFooter;
