import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AdminCommunications from '@/pages/admin/AdminCommunications';

const tenantState = {
  currentLocationId: 'local-1',
  tenant: {
    config: {
      features: {
        communicationsEnabled: false,
      },
      adminSidebar: { hiddenSections: [] },
    },
  },
};
const permissionsState = {
  canAccessSection: () => true,
  hasPermission: () => true,
};

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => tenantState,
}));

vi.mock('@/context/AdminPermissionsContext', () => ({
  useAdminPermissions: () => permissionsState,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/hooks/useI18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('@/data/api/communications', () => ({
  getCommunicationTemplates: async () => [],
  getCommunicationChannelPreference: async () => ({ channel: 'email' }),
  updateCommunicationChannelPreference: async () => ({ channel: 'email' }),
  listCommunications: async () => ({ total: 0, page: 1, pageSize: 20, hasMore: false, items: [] }),
  getCommunicationDetail: async () => null,
  previewCommunication: async () => null,
  createCommunication: async () => null,
  updateCommunicationDraft: async () => null,
  executeCommunication: async () => null,
  duplicateCommunication: async () => null,
  cancelScheduledCommunication: async () => null,
}));

vi.mock('@/data/api/barbers', () => ({
  getAdminBarbers: async () => [],
}));

vi.mock('@/data/api/appointments', () => ({
  getAppointmentsPage: async () => ({ total: 0, page: 1, pageSize: 100, hasMore: false, items: [] }),
}));

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminCommunications />
    </QueryClientProvider>,
  );
};

describe('AdminCommunications', () => {
  it('renders disabled state when tenant feature flag is off', async () => {
    tenantState.tenant.config.features.communicationsEnabled = false;
    permissionsState.canAccessSection = () => true;
    renderPage();

    expect(await screen.findByText('admin.communications.disabled.title')).toBeInTheDocument();
  });

  it('renders restricted state when user cannot access communications section', async () => {
    tenantState.tenant.config.features.communicationsEnabled = true;
    permissionsState.canAccessSection = () => false;
    permissionsState.hasPermission = () => false;
    renderPage();

    expect(await screen.findByText('admin.restricted.title')).toBeInTheDocument();
  });
});
