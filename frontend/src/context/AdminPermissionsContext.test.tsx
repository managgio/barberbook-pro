import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminPermissionsProvider, useAdminPermissions } from '@/context/AdminPermissionsContext';
import type { AdminRole } from '@/data/types';

let authState: { user: any };
let tenantState: { currentLocationId: string | null; tenant: any };
let rolesState: AdminRole[];

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => tenantState,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/hooks/useI18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('@/data/api/roles', () => ({
  getAdminRoles: async () => rolesState,
}));

const Probe = () => {
  const { canAccessSection } = useAdminPermissions();
  return <span data-testid="communications-access">{String(canAccessSection('communications'))}</span>;
};

describe('AdminPermissionsContext communications gating', () => {
  beforeEach(() => {
    authState = {
      user: {
        id: 'admin-1',
        role: 'admin',
        isLocalAdmin: true,
        isSuperAdmin: false,
        isPlatformAdmin: false,
        adminRoleId: 'role-1',
      },
    };
    tenantState = {
      currentLocationId: 'local-1',
      tenant: {
        config: {
          features: { communicationsEnabled: true },
          adminSidebar: { hiddenSections: [], visibleSections: ['communications'] },
        },
      },
    };
    rolesState = [
      {
        id: 'role-1',
        name: 'Admin',
        permissions: ['communications:view'],
      },
    ];
  });

  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('returns false when feature flag is disabled even if role has permission', async () => {
    tenantState.tenant.config.features.communicationsEnabled = false;

    render(
      <AdminPermissionsProvider>
        <Probe />
      </AdminPermissionsProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('communications-access')).toHaveTextContent('false');
    });
  });

  it('returns true when feature flag is enabled and role has communications:view', async () => {
    render(
      <AdminPermissionsProvider>
        <Probe />
      </AdminPermissionsProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('communications-access')).toHaveTextContent('true');
    });
  });

  it('keeps backwards compatibility with legacy communications section permission', async () => {
    rolesState = [
      {
        id: 'role-1',
        name: 'Admin',
        permissions: ['communications' as any],
      },
    ];

    render(
      <AdminPermissionsProvider>
        <Probe />
      </AdminPermissionsProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('communications-access')).toHaveTextContent('true');
    });
  });

  it('keeps optional sections hidden by default when not explicitly enabled', async () => {
    tenantState.tenant.config.adminSidebar = { hiddenSections: [] };

    render(
      <AdminPermissionsProvider>
        <Probe />
      </AdminPermissionsProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('communications-access')).toHaveTextContent('false');
    });
  });
});
