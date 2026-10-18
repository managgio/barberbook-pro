import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PlatformBrands from './PlatformBrands';
import { apiRequest } from '@/data/api/request';
import { queryKeys } from '@/lib/queryKeys';
import { deleteFromImageKit } from '@/lib/imagekit';

const request = vi.hoisted(() => vi.fn());

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'platform-user', isPlatformAdmin: true } }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/useI18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('@/lib/imagekit', () => ({ deleteFromImageKit: vi.fn(), uploadToImageKit: vi.fn() }));
vi.mock('@/data/api/request', () => ({ apiRequest: request }));

const locations = [{ id: 'local-a', name: 'Local A', timezone: 'Europe/Madrid' }];
let brandConfig: {
  features: { multiServiceBookingEnabled: boolean; faqEnabled?: boolean; galleryEnabled?: boolean };
  landing: { order: string[]; hiddenSections: string[] };
};
let multipleLocations = false;
let client: QueryClient;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  localStorage.clear();
  localStorage.setItem('platform:brands:tab', 'landing');
  multipleLocations = false;
  brandConfig = {
    features: { multiServiceBookingEnabled: true },
    landing: { order: ['faq', 'gallery', 'services'], hiddenSections: ['faq', 'gallery', 'services'] },
  };
  request.mockImplementation(async (path, options) => {
    const brand = { id: 'brand-a', name: 'Marca de prueba', subdomain: 'test-brand', isActive: true,
      locations: multipleLocations ? [...locations, { ...locations[0], id: 'local-b', name: 'Local B' }] : locations };
    if (path === '/platform/brands') return [brand];
    if (path === '/platform/brands/brand-a') return brand;
    if (path === '/platform/brands/brand-a/config') {
      if (options?.method === 'PATCH') brandConfig = options.body.data;
      return brandConfig;
    }
    if (path === '/platform/brands/brand-a/admins') return { locations: [] };
    if (path.includes('/locations/')) return multipleLocations ? { landing: { order: ['faq', 'gallery'], hiddenSections: [] } } : {};
    return null;
  });
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
});

afterEach(() => { cleanup(); client.clear(); localStorage.clear(); vi.unstubAllGlobals(); });
const mount = () => render(<QueryClientProvider client={client}><PlatformBrands /></QueryClientProvider>);
const openGroup = async (group = 'website.images', scope = 'platform.landing.title') => {
  const panel = await screen.findByRole('region', { name: scope });
  await userEvent.click(await within(panel).findByRole('button', { name: group }));
  return panel;
};
const save = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/platform/brands/brand-a/config', expect.objectContaining({ method: 'PATCH' })));
};

it.each(['faq', 'gallery'] as const)('enables the %s module and its landing section from the brand row, and saves both', async (section) => {
  mount();
  const toggle = await screen.findByRole('switch', { name: `platform.${section}.sectionTitle` });
  expect(toggle).not.toBeChecked();
  expect(toggle).toBeEnabled();
  expect(screen.queryByRole('switch', { name: `platform.${section}.title` })).not.toBeInTheDocument();
  await userEvent.click(toggle);
  expect(toggle).toBeChecked();
  await save();
  expect(brandConfig.features).toMatchObject({ [`${section}Enabled`]: true, multiServiceBookingEnabled: true });
  expect(brandConfig.landing.hiddenSections).not.toContain(section);
  expect(brandConfig.landing.hiddenSections).toContain('services');
  expect(brandConfig.landing.order.slice(0, 3)).toEqual(['faq', 'gallery', 'services']);
});

it.each(['faq', 'gallery'] as const)('disables the %s module and landing section from the same brand switch', async (section) => {
  brandConfig.features[`${section}Enabled`] = true;
  brandConfig.landing.hiddenSections = [];
  mount();
  const toggle = await screen.findByRole('switch', { name: `platform.${section}.sectionTitle` });
  await waitFor(() => expect(toggle).toBeChecked());
  await userEvent.click(toggle);
  expect(toggle).not.toBeChecked();
  await save();
  expect(brandConfig.features[`${section}Enabled`]).toBe(false);
  expect(brandConfig.features.multiServiceBookingEnabled).toBe(true);
  expect(brandConfig.landing.hiddenSections).toContain(section);
});

it('keeps local overrides blocked until the brand enables the module', async () => {
  multipleLocations = true;
  mount();
  await waitFor(() => expect(screen.getAllByRole('switch', { name: 'platform.gallery.sectionTitle' })).toHaveLength(2));
  const [brandToggle, localToggle] = screen.getAllByRole('switch', { name: 'platform.gallery.sectionTitle' });
  expect(localToggle).toBeDisabled();
  expect(localToggle).toHaveAccessibleDescription('platform.landing.capabilityRequired');
  await userEvent.click(brandToggle);
  await waitFor(() => expect(localToggle).toBeEnabled());
  expect(localToggle).toBeChecked();
  await userEvent.click(brandToggle);
  expect(localToggle).toBeDisabled();
  expect(localToggle).not.toBeChecked();
});

it('keeps the brand capability enabled when hiding the section in a local override', async () => {
  multipleLocations = true;
  brandConfig.features.galleryEnabled = true;
  brandConfig.landing.hiddenSections = [];
  mount();
  await waitFor(() => expect(screen.getAllByRole('switch', { name: 'platform.gallery.sectionTitle' })).toHaveLength(2));
  const [brandToggle, localToggle] = screen.getAllByRole('switch', { name: 'platform.gallery.sectionTitle' });
  await waitFor(() => expect(localToggle).toBeEnabled());
  await userEvent.click(localToggle);
  expect(localToggle).not.toBeChecked();
  expect(brandToggle).toBeChecked();
  await save();
  expect(brandConfig.features.galleryEnabled).toBe(true);
  expect(apiRequest).toHaveBeenCalledWith('/platform/locations/local-a/config', expect.objectContaining({
    method: 'PATCH', body: { data: { landing: { order: expect.any(Array), hiddenSections: ['gallery'] } } },
  }));
});

it('shows locally edited photos in Platform even for a single location and preserves inherited fields', async () => {
  Object.assign(brandConfig, { branding: { heroImageUrl: 'https://images.test/brand.webp', heroBackgroundUrl: 'https://images.test/background.webp' } });
  const prior = request.getMockImplementation()!;
  request.mockImplementation(async (path, options) => path === '/platform/locations/local-a/config'
    ? { _revision: 'local-version', branding: { heroImageUrl: 'https://images.test/from-admin.webp', heroImageFileId: 'admin-photo', heroImage2Url: 'https://images.test/second.webp' } }
    : prior(path, options));
  mount();
  const panel = await openGroup();
  expect(screen.getAllByText('platform.landing.title')).toHaveLength(1);
  expect(within(panel).queryByText('platform.landing.title')).not.toBeInTheDocument();
  expect(screen.queryByText('platform.landing.website')).not.toBeInTheDocument();
  expect(within(panel).queryByRole('heading', { name: 'platform.landing.brand' })).not.toBeInTheDocument();
  expect(screen.queryByRole('combobox', { name: 'platform.landing.selectLocation' })).not.toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'platform.landing.brand' })).not.toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'platform.landing.location' })).not.toBeInTheDocument();
  const previews = await screen.findAllByRole('img', { name: 'Imagen principal (portada)' });
  expect(previews).toHaveLength(1);
  expect(previews[0]).toHaveAttribute('src', 'https://images.test/from-admin.webp');
  expect(screen.getByRole('img', { name: 'Imagen principal 2' })).toHaveAttribute('src', 'https://images.test/second.webp');
  expect(screen.getByRole('img', { name: 'Fondo hero (mainImage)' })).toHaveAttribute('src', 'https://images.test/background.webp');
});

it('does not replace an unsaved Platform draft when saved configuration refreshes', async () => {
  mount();
  const toggle = await screen.findByRole('switch', { name: 'platform.faq.sectionTitle' });
  await userEvent.click(toggle);
  await act(async () => client.setQueryData(queryKeys.platformBrandConfig('brand-a'), { ...brandConfig, features: { ...brandConfig.features, faqEnabled: false }, _revision: 'new-server-version' }));
  expect(toggle).toBeChecked();
  expect(deleteFromImageKit).not.toHaveBeenCalled();
});

it('refreshes the local image preview when an admin publishes a new photo', async () => {
  const prior = request.getMockImplementation()!;
  request.mockImplementation(async (path, options) => path === '/platform/locations/local-a/config'
    ? { _revision: 'local-version', branding: { heroImageUrl: 'https://images.test/old.webp', heroImageFileId: 'old-photo' } }
    : prior(path, options));
  mount(); await openGroup();
  expect(await screen.findByRole('img', { name: 'Imagen principal (portada)' })).toHaveAttribute('src', 'https://images.test/old.webp');
  await act(async () => client.setQueryData(queryKeys.platformLocationConfig('local-a'), {
    _revision: 'new-version', branding: { heroImageUrl: 'https://images.test/new.webp', heroImageFileId: 'new-photo' },
  }));
  await waitFor(() => expect(screen.getByRole('img', { name: 'Imagen principal (portada)' })).toHaveAttribute('src', 'https://images.test/new.webp'));
  await act(async () => client.setQueryData(queryKeys.platformBrand('brand-a'), {
    ...(client.getQueryData(queryKeys.platformBrand('brand-a')) as object), name: 'Nombre actualizado',
  }));
  expect(screen.getByRole('img', { name: 'Imagen principal (portada)' })).toHaveAttribute('src', 'https://images.test/new.webp');
});

it('preserves inherited presentation text when Platform removes a local photo and defers deletion until save', async () => {
  multipleLocations = true;
  Object.assign(brandConfig.landing, { presentation: { sections: [{ enabled: true, title: 'Nuestra historia', body: 'Texto de la marca', imageUrl: 'https://images.test/presentation.webp', imageFileId: 'shared-photo', imagePosition: 'left' }] } });
  mount();
  await openGroup('website.platformMediaPresentation', 'platform.landing.location');
  const localCard = (await screen.findByRole('img', { name: 'Presentación' })).closest('.rounded-2xl') as HTMLElement;
  await userEvent.click(within(localCard).getByRole('button', { name: 'Quitar imagen' }));
  expect(deleteFromImageKit).not.toHaveBeenCalled();
  expect(screen.getAllByDisplayValue('Nuestra historia')).toHaveLength(1);
  await save();
  expect(apiRequest).toHaveBeenCalledWith('/platform/locations/local-a/config', expect.objectContaining({
    method: 'PATCH', body: { data: expect.objectContaining({ landing: expect.objectContaining({ presentation: { sections: [
      expect.objectContaining({ title: 'Nuestra historia', body: 'Texto de la marca', imageUrl: '', imageFileId: '' }), expect.any(Object),
    ] } }) }) },
  }));
  expect(deleteFromImageKit).not.toHaveBeenCalled();
});

it('restores separate brand and local panels only when there are multiple locations', async () => {
  multipleLocations = true;
  Object.assign(brandConfig, { branding: { heroImageUrl: 'https://images.test/brand.webp' } });
  const prior = request.getMockImplementation()!;
  request.mockImplementation(async (path, options) => path === '/platform/locations/local-a/config'
    ? { branding: { heroImageUrl: 'https://images.test/local.webp' } } : prior(path, options));
  mount();
  expect(screen.queryByRole('region', { name: 'platform.landing.title' })).not.toBeInTheDocument();
  const brandPanel = await openGroup('website.images', 'platform.landing.brand');
  const localPanel = await openGroup('website.images', 'platform.landing.location');
  expect(within(brandPanel).getByRole('img', { name: 'Imagen principal (portada)' })).toHaveAttribute('src', 'https://images.test/brand.webp');
  expect(within(localPanel).getByRole('img', { name: 'Imagen principal (portada)' })).toHaveAttribute('src', 'https://images.test/local.webp');
  expect(within(localPanel).getByRole('combobox', { name: 'platform.landing.selectLocation' })).toHaveTextContent('Local A');
  const photo = within(brandPanel).getByRole('img', { name: 'Imagen principal (portada)' });
  await userEvent.click(within(photo.closest('.space-y-2') as HTMLElement).getByRole('button', { name: 'Quitar imagen' }));
  await save();
  expect(apiRequest).not.toHaveBeenCalledWith('/platform/locations/local-a/config', expect.objectContaining({ method: 'PATCH' }));
  expect(within(localPanel).getByRole('img', { name: 'Imagen principal (portada)' })).toHaveAttribute('src', 'https://images.test/local.webp');
});

it('loads and saves another location without leaking photos or changing the brand default location', async () => {
  multipleLocations = true;
  const prior = request.getMockImplementation()!;
  let resolveLocalB: (value: object) => void;
  const pendingLocalB = new Promise((resolve) => { resolveLocalB = resolve; });
  let localB = { _revision: 'local-b-v1', branding: { heroImageUrl: 'https://images.test/b.webp', heroImageFileId: 'photo-b' } };
  request.mockImplementation(async (path, options) => {
    if (path === '/platform/locations/local-a/config') return { _revision: 'local-a-v1', branding: { heroImageUrl: 'https://images.test/a.webp' } };
    if (path === '/platform/locations/local-b/config') {
      if (options?.method === 'PATCH') { localB = options.body.data; return { data: localB }; }
      await pendingLocalB; return localB;
    }
    return prior(path, options);
  });
  mount(); await openGroup('website.images', 'platform.landing.location');
  await screen.findByRole('img', { name: 'Imagen principal (portada)' });
  await userEvent.click(screen.getByRole('combobox', { name: 'platform.landing.selectLocation' }));
  await userEvent.click(screen.getByRole('option', { name: 'Local B' }));
  expect(screen.queryByRole('img', { name: 'Imagen principal (portada)' })).not.toBeInTheDocument();
  await act(async () => resolveLocalB({}));
  await openGroup('website.images', 'platform.landing.location');
  const photo = await screen.findByRole('img', { name: 'Imagen principal (portada)' });
  expect(photo).toHaveAttribute('src', 'https://images.test/b.webp');
  await userEvent.click(within(photo.closest('.space-y-2') as HTMLElement).getByRole('button', { name: 'Quitar imagen' }));
  expect(screen.getByRole('combobox', { name: 'platform.landing.selectLocation' })).toBeDisabled();
  await save();
  await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/platform/locations/local-b/config', expect.objectContaining({
    method: 'PATCH', body: { data: { _revision: 'local-b-v1', branding: { heroImageUrl: '', heroImageFileId: '' } } },
  })));
  expect(apiRequest).not.toHaveBeenCalledWith('/platform/locations/local-a/config', expect.objectContaining({ method: 'PATCH' }));
  expect(apiRequest).toHaveBeenCalledWith('/platform/brands/brand-a', expect.objectContaining({ method: 'PATCH', body: expect.objectContaining({ defaultLocationId: 'local-a' }) }));
  expect(deleteFromImageKit).not.toHaveBeenCalled();
});

it('retains an unsaved local image change and its revision when the tenant publishes concurrently', async () => {
  const prior = request.getMockImplementation()!;
  request.mockImplementation(async (path, options) => path === '/platform/locations/local-a/config'
    ? { _revision: 'original-revision', branding: { heroImageUrl: 'https://images.test/original.webp', heroImageFileId: 'original' } } : prior(path, options));
  mount(); await openGroup(); const photo = await screen.findByRole('img', { name: 'Imagen principal (portada)' });
  await userEvent.click(within(photo.closest('.space-y-2') as HTMLElement).getByRole('button', { name: 'Quitar imagen' }));
  await act(async () => client.setQueryData(queryKeys.platformLocationConfig('local-a'), { _revision: 'new-revision', branding: { heroImageUrl: 'https://images.test/concurrent.webp' } }));
  expect(screen.queryByRole('img', { name: 'Imagen principal (portada)' })).not.toBeInTheDocument();
  await save();
  await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/platform/locations/local-a/config', expect.objectContaining({
    method: 'PATCH', body: { data: expect.objectContaining({ _revision: 'original-revision', branding: { heroImageUrl: '', heroImageFileId: '' } }) },
  })));
});

it('uses the single location section overrides and saves the unified control without losing presentation content', async () => {
  brandConfig.features.galleryEnabled = true;
  const local = { _revision: 'local-v1', landing: {
    order: ['gallery', 'faq', 'services'], hiddenSections: ['gallery'],
    presentation: { sections: [{ title: 'Contenido del local', body: 'Texto conservado', imageUrl: 'https://images.test/local.webp' }] },
  } };
  const prior = request.getMockImplementation()!;
  request.mockImplementation(async (path, options) => path === '/platform/locations/local-a/config' ? local : prior(path, options));
  mount();
  const toggle = await screen.findByRole('switch', { name: 'platform.gallery.sectionTitle' });
  expect(toggle).not.toBeChecked();
  const panel = screen.getByRole('region', { name: 'platform.landing.title' });
  expect([...panel.querySelectorAll('[data-section-key]')].slice(0, 3).map(node => node.getAttribute('data-section-key'))).toEqual(local.landing.order);
  await userEvent.click(toggle);
  await save();
  expect(brandConfig.landing.order.slice(0, 3)).toEqual(local.landing.order);
  expect(brandConfig.landing.hiddenSections).not.toContain('gallery');
  expect(apiRequest).toHaveBeenCalledWith('/platform/locations/local-a/config', expect.objectContaining({
    method: 'PATCH', body: { data: expect.objectContaining({ _revision: 'local-v1', landing: expect.objectContaining({
      hiddenSections: [], presentation: local.landing.presentation,
    }) }) },
  }));
});

it('uses the single location header overrides and keeps its photos when changing the unified header control', async () => {
  Object.assign(brandConfig, { branding: { heroImageEnabled: true } });
  const local = { _revision: 'local-v1', branding: { heroImageEnabled: false, heroImageUrl: 'https://images.test/admin.webp' } };
  const prior = request.getMockImplementation()!;
  request.mockImplementation(async (path, options) => path === '/platform/locations/local-a/config' ? local : prior(path, options));
  mount();
  const panel = await openGroup('platform.landing.header');
  const toggle = within(within(panel).getByText('Mostrar imagen principal').parentElement!.parentElement!).getByRole('switch');
  expect(toggle).not.toBeChecked();
  await userEvent.click(toggle);
  await save();
  expect(brandConfig).toMatchObject({ branding: { heroImageEnabled: true } });
  expect(apiRequest).toHaveBeenCalledWith('/platform/locations/local-a/config', expect.objectContaining({
    method: 'PATCH', body: { data: { _revision: 'local-v1', branding: { ...local.branding, heroImageEnabled: true } } },
  }));
});

it('opens one settings group at a time without duplicating controls', async () => {
  mount();
  const panel = await openGroup();
  expect(within(panel).queryByRole('switch', { name: 'platform.gallery.sectionTitle' })).not.toBeInTheDocument();
  await openGroup('website.platformMediaPresentation');
  expect(within(panel).queryByText('Imagen principal (portada)')).not.toBeInTheDocument();
  await openGroup('platform.landing.sections');
  expect(within(panel).getAllByRole('switch', { name: 'platform.gallery.sectionTitle' })).toHaveLength(1);
  expect(within(panel).queryByText('Sección 1')).not.toBeInTheDocument();
});

it('keeps local photos when a single location brand grows to multiple locations', async () => {
  Object.assign(brandConfig, { branding: { heroImageUrl: 'https://images.test/brand.webp' } });
  const prior = request.getMockImplementation()!;
  request.mockImplementation(async (path, options) => path === '/platform/locations/local-a/config'
    ? { branding: { heroImageUrl: 'https://images.test/admin.webp' } } : prior(path, options));
  mount(); await openGroup();
  expect(screen.getByRole('img', { name: 'Imagen principal (portada)' })).toHaveAttribute('src', 'https://images.test/admin.webp');
  await act(async () => client.setQueryData(queryKeys.platformBrands(), [{
    ...(client.getQueryData(queryKeys.platformBrand('brand-a')) as object),
    locations: [...locations, { ...locations[0], id: 'local-b', name: 'Local B' }],
  }]));
  const brandPanel = await screen.findByRole('region', { name: 'platform.landing.brand' });
  const localPanel = await openGroup('website.images', 'platform.landing.location');
  expect(within(brandPanel).getByRole('img', { name: 'Imagen principal (portada)' })).toHaveAttribute('src', 'https://images.test/brand.webp');
  expect(within(localPanel).getByRole('img', { name: 'Imagen principal (portada)' })).toHaveAttribute('src', 'https://images.test/admin.webp');
  expect(screen.queryByRole('region', { name: 'platform.landing.title' })).not.toBeInTheDocument();
});

it('persists optional appearance through the Config form without overwriting existing theme or local photos', async () => {
  localStorage.setItem('platform:brands:tab', 'config');
  Object.assign(brandConfig, { theme: { primary: '#fea4bb', mode: 'dark', headingFont: { fileId: 'font-a', url: 'https://cdn.test/font.ttf', name: 'Brand font', format: 'ttf' } } });
  mount();
  const field = await screen.findByLabelText('platform.appearance.secondary');
  await userEvent.type(field, '#654321');
  await save();
  expect(brandConfig).toMatchObject({ theme: { primary: '#fea4bb', mode: 'dark', secondary: '#654321', headingFont: { fileId: 'font-a' } } });
  expect(apiRequest).not.toHaveBeenCalledWith('/platform/locations/local-a/config', expect.objectContaining({ method: 'PATCH' }));
  await userEvent.click(screen.getByRole('button', { name: 'platform.appearance.resetFont' }));
  await userEvent.click(screen.getByRole('button', { name: 'platform.appearance.resetColor' }));
  await save();
  await waitFor(() => expect(brandConfig).toMatchObject({ theme: { primary: '#fea4bb', mode: 'dark', secondary: null, headingFont: null } }));
  expect(deleteFromImageKit).not.toHaveBeenCalled();
});
