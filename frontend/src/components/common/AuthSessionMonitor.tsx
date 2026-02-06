import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '@/context/AuthContext';
import { AUTH_SESSION_ERROR_EVENT } from '@/data/api/request';
import { toast } from '@/hooks/use-toast';

const COOLDOWN_MS = 3_000;

const AuthSessionMonitor = () => {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isHandlingRef = useRef(false);

  useEffect(() => {
    const handleAuthSessionError = (event: Event) => {
      if (!isAuthenticated) return;
      if (isHandlingRef.current) return;

      const customEvent = event as CustomEvent<{ status?: number }>;
      const status = customEvent.detail?.status;
      if (status !== 401 && status !== 403) return;

      isHandlingRef.current = true;
      const currentPath = `${location.pathname}${location.search}`;
      const redirectPath = location.pathname.startsWith('/auth')
        ? '/auth'
        : `/auth?reason=session-expired&redirect=${encodeURIComponent(currentPath)}`;

      toast({
        title: 'Sesión expirada',
        description: 'Vuelve a iniciar sesión para continuar.',
        variant: 'destructive',
      });

      void logout()
        .catch((error) => {
          console.error('Error cerrando sesión tras 401/403', error);
        })
        .finally(() => {
          navigate(redirectPath, { replace: true });
          window.setTimeout(() => {
            isHandlingRef.current = false;
          }, COOLDOWN_MS);
        });
    };

    window.addEventListener(AUTH_SESSION_ERROR_EVENT, handleAuthSessionError as EventListener);
    return () => {
      window.removeEventListener(AUTH_SESSION_ERROR_EVENT, handleAuthSessionError as EventListener);
    };
  }, [isAuthenticated, location.pathname, location.search, logout, navigate]);

  return null;
};

export default AuthSessionMonitor;
