import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTenant } from '@/context/TenantContext';
import { AdminRole, AdminSectionKey } from '@/data/types';
import { ADMIN_REQUIRED_SECTIONS, ADMIN_SECTION_KEYS } from '@/data/adminSections';
import { getAdminRoles } from '@/data/api';
import { useToast } from '@/hooks/use-toast';

interface AdminPermissionsContextValue {
  roles: AdminRole[];
  isLoading: boolean;
  canAccessSection: (section: AdminSectionKey) => boolean;
}

const AdminPermissionsContext = createContext<AdminPermissionsContextValue | undefined>(undefined);

export const AdminPermissionsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { currentLocationId, tenant } = useTenant();
  const { toast } = useToast();
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const tenantHiddenSections = useMemo(() => {
    const hidden = tenant?.config?.adminSidebar?.hiddenSections;
    if (!Array.isArray(hidden)) return [];
    return hidden.filter((section): section is AdminSectionKey => ADMIN_SECTION_KEYS.includes(section as AdminSectionKey));
  }, [tenant?.config?.adminSidebar?.hiddenSections]);

  const isSectionEnabledForTenant = useCallback(
    (section: AdminSectionKey) => {
      if (ADMIN_REQUIRED_SECTIONS.includes(section)) return true;
      return !tenantHiddenSections.includes(section);
    },
    [tenantHiddenSections],
  );

  useEffect(() => {
    let active = true;
    if (!user || user.role !== 'admin' || !user.isLocalAdmin || user.isSuperAdmin || user.isPlatformAdmin) {
      setRoles([]);
      setIsLoading(false);
      return () => {
        active = false;
      };
    }

    const loadRoles = async () => {
      setIsLoading(true);
      try {
        const data = await getAdminRoles();
        if (active) {
          setRoles(data);
        }
      } catch (error) {
        if (active) {
          toast({
            title: 'Error',
            description: 'No se pudieron cargar los roles.',
            variant: 'destructive',
          });
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    loadRoles();

    return () => {
      active = false;
    };
  }, [toast, user, currentLocationId]);

  const currentRole = useMemo(
    () => roles.find((role) => role.id === user?.adminRoleId) || null,
    [roles, user?.adminRoleId],
  );

  const canAccessSection = useCallback(
    (section: AdminSectionKey) => {
      if (!user) return false;
      if (!isSectionEnabledForTenant(section)) return false;
      if (user.isSuperAdmin || user.isPlatformAdmin) return true;
      if (user.role !== 'admin' || !user.isLocalAdmin) return false;
      if (!user.adminRoleId) return true;
      return currentRole?.permissions.includes(section) ?? false;
    },
    [currentRole, isSectionEnabledForTenant, user],
  );

  const value = useMemo(
    () => ({
      roles,
      isLoading,
      canAccessSection,
    }),
    [roles, isLoading, canAccessSection],
  );

  return (
    <AdminPermissionsContext.Provider value={value}>
      {children}
    </AdminPermissionsContext.Provider>
  );
};

export const useAdminPermissions = () => {
  const context = useContext(AdminPermissionsContext);
  if (!context) {
    throw new Error('useAdminPermissions must be used within an AdminPermissionsProvider');
  }
  return context;
};
