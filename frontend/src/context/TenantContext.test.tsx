import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TenantBootstrap } from '@/data/types';
import { getTenantBootstrap } from '@/data/api/tenant';
import { fetchSiteSettingsCached } from '@/lib/siteSettingsQuery';
import managgioLogo from '@/assets/img/managgio/logo.webp';
import { TenantProvider, useTenant } from './TenantContext';

vi.mock('@/data/api/tenant', () => ({ getTenantBootstrap: vi.fn() }));
vi.mock('@/lib/siteSettingsQuery', () => ({ fetchSiteSettingsCached: vi.fn() }));

const bootstrap: TenantBootstrap = {
  brand: null,
  locations: [],
  currentLocalId: 'local-test',
  isPlatform: true,
  config: {
    branding: { name: 'Tenant de prueba' },
    theme: { primary: '#fea4bb', mode: 'light' },
  },
};
const Probe = () => {
  const { isReady, tenant, refreshTenant } = useTenant();
  return <>
    <span>{isReady ? (tenant?.isPlatform ? 'platform-ready' : 'tenant-ready') : 'loading'}</span>
    <button onClick={() => void refreshTenant()}>refresh</button>
  </>;
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  document.documentElement.removeAttribute('style');
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.classList.remove('dark');
  document.head.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]').forEach((link) => link.remove());
  vi.mocked(getTenantBootstrap).mockResolvedValue(bootstrap);
});
afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('style');
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.classList.remove('dark');
});

describe('TenantProvider platform branding', () => {
  it('uses dedicated PNG home-screen icons while retaining the original social logo', async () => {
    vi.mocked(getTenantBootstrap).mockResolvedValue({
      ...bootstrap,
      config: { ...bootstrap.config, branding: { logoDarkUrl: 'https://images.test/tenant.webp' } },
    });
    render(<TenantProvider><Probe /></TenantProvider>);
    await screen.findByText('platform-ready');
    const icon = document.head.querySelector('link[rel="icon"]');
    const touchIcon = document.head.querySelector('link[rel="apple-touch-icon"]');
    expect(icon).toHaveAttribute('href', `${window.location.origin}/icons/managgio-app-192.png?v=2`);
    expect(icon).toHaveAttribute('type', 'image/png');
    expect(icon).toHaveAttribute('sizes', '192x192');
    expect(touchIcon).toHaveAttribute('href', `${window.location.origin}/apple-touch-icon.png?v=2`);
    expect(touchIcon).toHaveAttribute('type', 'image/png');
    expect(touchIcon).toHaveAttribute('sizes', '180x180');
    expect(document.head.querySelector('meta[property="og:image"]'))
      .toHaveAttribute('content', new URL(managgioLogo, window.location.origin).toString());
  });

  it('keeps the Platform identity, yellow palette and dark mode even with pink tenant config', async () => {
    render(<TenantProvider><Probe /></TenantProvider>);
    await screen.findByText('platform-ready');
    expect(document.title).toBe('Managgio | Plataforma');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('42 97% 56%');
    expect(document.documentElement.style.getPropertyValue('--primary-foreground')).toBe('0 0% 10%');
    expect(fetchSiteSettingsCached).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'refresh' }));
    await waitFor(() => expect(getTenantBootstrap).toHaveBeenCalledTimes(2));
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('42 97% 56%');
    expect(fetchSiteSettingsCached).not.toHaveBeenCalled();
  });

  it('preserves the configured theme and identity on tenant domains', async () => {
    vi.mocked(getTenantBootstrap).mockResolvedValue({ ...bootstrap, isPlatform: false });
    vi.mocked(fetchSiteSettingsCached).mockResolvedValue({} as Awaited<ReturnType<typeof fetchSiteSettingsCached>>);
    render(<TenantProvider><Probe /></TenantProvider>);
    await screen.findByText('tenant-ready');
    expect(document.title).toBe('Tenant de prueba');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('345 98% 82%');
    expect(fetchSiteSettingsCached).toHaveBeenCalledWith('local-test');
    expect(document.head.querySelector('link[rel="apple-touch-icon"]'))
      .toHaveAttribute('href', `${window.location.origin}/apple-touch-icon.png?v=2`);
  });

  it('replaces the default icons with tenant branding without retaining Managgio dimensions', async () => {
    vi.mocked(fetchSiteSettingsCached).mockResolvedValue({} as Awaited<ReturnType<typeof fetchSiteSettingsCached>>);
    render(<TenantProvider><Probe /></TenantProvider>);
    await screen.findByText('platform-ready');
    const tenantLogo = 'https://images.test/salon-logo.png';
    vi.mocked(getTenantBootstrap).mockResolvedValue({ ...bootstrap, isPlatform: false, config: {
      ...bootstrap.config, branding: { name: 'Salon', logoLightUrl: tenantLogo },
    } });
    fireEvent.click(screen.getByRole('button', { name: 'refresh' }));
    await screen.findByText('tenant-ready');
    await waitFor(() => expect(fetchSiteSettingsCached).toHaveBeenCalledWith('local-test'));
    for (const rel of ['icon', 'apple-touch-icon']) {
      const links = document.head.querySelectorAll(`link[rel="${rel}"]`);
      expect(links).toHaveLength(1);
      expect(links[0]).toHaveAttribute('href', tenantLogo);
      expect(links[0]).not.toHaveAttribute('sizes');
    }
  });
});
