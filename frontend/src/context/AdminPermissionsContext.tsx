import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTenant } from '@/context/TenantContext';
import { AdminRole, AdminSectionKey, AdminPermissionKey } from '@/data/types';
import {
  ADMIN_REQUIRED_SECTIONS,
  ADMIN_SECTION_KEYS,
  isAdminSectionDefaultVisible,
} from '@/data/adminSections';
import { getAdminRoles } from '@/data/api/roles';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/hooks/useI18n';

interface AdminPermissionsContextValue {
  roles: AdminRole[];
  isLoading: boolean;
  canAccessSection: (section: AdminSectionKey) => boolean;
  hasPermission: (permission: AdminPermissionKey) => boolean;
}

const AdminPermissionsContext = createContext<AdminPermissionsContextValue | undefined>(undefined);

export const AdminPermissionsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { currentLocationId, tenant } = useTenant();
  const { toast } = useToast();
  const { t } = useI18n();
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const tenantSidebarVisibility = useMemo(() => {
    const hidden = tenant?.config?.adminSidebar?.hiddenSections;
    const visible = tenant?.config?.adminSidebar?.visibleSections;
    const hiddenSections = Array.isArray(hidden)
      ? hidden.filter((section): section is AdminSectionKey =>
          ADMIN_SECTION_KEYS.includes(section as AdminSectionKey),
        )
      : [];
    const visibleSections = Array.isArray(visible)
      ? visible.filter((section): section is AdminSectionKey =>
          ADMIN_SECTION_KEYS.includes(section as AdminSectionKey),
        )
      : [];
    return { hiddenSections, visibleSections };
  }, [tenant?.config?.adminSidebar?.hiddenSections, tenant?.config?.adminSidebar?.visibleSections]);

  const isSectionEnabledForTenant = useCallback(
    (section: AdminSectionKey) => {
      if (section === 'communications' && tenant?.config?.features?.communicationsEnabled !== true) {
        return false;
      }
      if (ADMIN_REQUIRED_SECTIONS.includes(section)) return true;
      const isHidden = tenantSidebarVisibility.hiddenSections.includes(section);
      if (isHidden) return false;
      if (!isAdminSectionDefaultVisible(section)) {
        return tenantSidebarVisibility.visibleSections.includes(section);
      }
      return true;
    },
    [tenant?.config?.features?.communicationsEnabled, tenantSidebarVisibility.hiddenSections, tenantSidebarVisibility.visibleSections],
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
            title: t('admin.common.error'),
            description: t('admin.roles.toast.loadError'),
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
  }, [currentLocationId, t, toast, user]);

  const currentRole = useMemo(
    () => roles.find((role) => role.id === user?.adminRoleId) || null,
    [roles, user?.adminRoleId],
  );

  const hasPermission = useCallback(
    (permission: AdminPermissionKey) => {
      if (!user) return false;
      if (user.isSuperAdmin || user.isPlatformAdmin) return true;
      if (user.role !== 'admin' || !user.isLocalAdmin) return false;
      if (!user.adminRoleId) return true;
      const permissions = (currentRole?.permissions || []) as AdminPermissionKey[];
      if (permissions.includes(permission)) return true;
      if (
        permission === 'communications:view' ||
        permission === 'communications:view_history'
      ) {
        return permissions.includes('communications');
      }
      return false;
    },
    [currentRole, user],
  );

  const canAccessSection = useCallback(
    (section: AdminSectionKey) => {
      if (!user) return false;
      if (!isSectionEnabledForTenant(section)) return false;
      if (section === 'communications') {
        return hasPermission('communications:view');
      }
      return hasPermission(section);
    },
    [hasPermission, isSectionEnabledForTenant, user],
  );

  const value = useMemo(
    () => ({
      roles,
      isLoading,
      canAccessSection,
      hasPermission,
    }),
    [roles, isLoading, canAccessSection, hasPermission],
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
