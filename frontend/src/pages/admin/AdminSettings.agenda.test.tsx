import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DEFAULT_SITE_SETTINGS } from '@/data/salonInfo';
import type { ShopSchedule, SiteSettings } from '@/data/types';
import es from '@/i18n/locales/es.json';
import { updateShopSchedule } from '@/data/api/schedules';
import { updateSiteSettings } from '@/data/api/settings';
import { dispatchSchedulesUpdated, dispatchSiteSettingsUpdated } from '@/lib/adminEvents';
import AdminSettings from './AdminSettings';

const state = vi.hoisted(() => ({
  localId: 'local-a',
  settings: {} as Record<string, SiteSettings>,
  schedules: {} as Record<string, ShopSchedule>,
  refetch: vi.fn(async () => ({})),
  toast: vi.fn(),
}));
vi.mock('@/context/TenantContext', () => ({ useTenant: () => ({
  currentLocationId: state.localId, tenant: { brand: { id: 'brand-a' }, config: {} },
}) }));
vi.mock('@tanstack/react-query', async (original) => ({
  ...await original<typeof import('@tanstack/react-query')>(),
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    data: queryKey[0] === 'site-settings' ? state.settings[queryKey[1]]
      : queryKey[0] === 'shop-schedule' ? state.schedules[queryKey[1]] : undefined,
    isLoading: false, error: null, refetch: state.refetch,
  }),
}));
vi.mock('@/hooks/useI18n', () => ({ useI18n: () => ({
  language: 'es', t: (key: string, values: Record<string, string | number> = {}) =>
    Object.entries(values).reduce((text, [name, value]) => text.split('{' + name + '}').join(String(value)), (es as Record<string, string>)[key] ?? key),
}) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: state.toast }) }));
vi.mock('@/lib/businessCopy', () => ({ useBusinessCopy: () => ({ staff: { fromWithDefinitePlural: 'del equipo' }, location: {} }) }));
vi.mock('@/components/admin/InlineTranslationPopover', () => ({ default: () => null }));
vi.mock('@/data/api/schedules', () => ({ getShopSchedule: vi.fn(), updateShopSchedule: vi.fn() }));
vi.mock('@/data/api/settings', () => ({ updateSiteSettings: vi.fn() }));
vi.mock('@/lib/adminEvents', () => ({ dispatchSchedulesUpdated: vi.fn(), dispatchSiteSettingsUpdated: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  state.localId = 'local-a';
  for (const localId of ['local-a', 'local-b']) {
    state.settings[localId] = structuredClone(DEFAULT_SITE_SETTINGS);
    state.schedules[localId] = { ...structuredClone(DEFAULT_SITE_SETTINGS.openingHours), bufferMinutes: 0 };
  }
  sessionStorage.setItem('admin-settings-active-tab', 'availability');
});
afterEach(() => { cleanup(); sessionStorage.clear(); });

it('saves hours and rules once through the schedule endpoint and keeps the draft across tabs', async () => {
  let finish!: (value: ShopSchedule) => void;
  vi.mocked(updateShopSchedule).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  render(<AdminSettings />);
  const saveButton = screen.getByRole('button', { name: 'Guardar cambios' });
  expect(saveButton.closest('[role="tabpanel"]')).toBeNull();
  expect(screen.getByRole('tablist').parentElement?.parentElement).toContainElement(saveButton);
  await userEvent.click(screen.getByRole('button', { name: '10 min' }));
  await userEvent.click(screen.getByRole('tab', { name: 'Operativa' }));
  await userEvent.click(screen.getByRole('tab', { name: 'Agenda y horarios' }));
  expect(screen.getByRole('spinbutton', { name: 'Minutos' })).toHaveValue(10);
  await userEvent.dblClick(screen.getByRole('button', { name: 'Guardar cambios' }));
  expect(updateShopSchedule).toHaveBeenCalledTimes(1);
  expect(updateSiteSettings).not.toHaveBeenCalled();
  expect(screen.getByRole('spinbutton', { name: 'Minutos' })).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('Guardando...');
  const payload = vi.mocked(updateShopSchedule).mock.calls[0][0];
  expect(payload.bufferMinutes).toBe(10);
  expect(payload.monday).toEqual(state.settings['local-a'].openingHours.monday);
  await act(async () => finish(payload));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Cambios guardados'));
  expect(dispatchSchedulesUpdated).toHaveBeenCalledWith({ source: 'admin-settings', localId: 'local-a' });
  expect(dispatchSiteSettingsUpdated).toHaveBeenCalledWith(expect.objectContaining({ openingHours: payload }));
});

it('preserves a rejected draft for correction or retry without writing site settings', async () => {
  vi.mocked(updateShopSchedule).mockRejectedValueOnce(new Error('Error de conexión'));
  render(<AdminSettings />);
  await userEvent.click(screen.getByRole('button', { name: '15 min' }));
  await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Error de conexión');
  expect(screen.getByRole('spinbutton', { name: 'Minutos' })).toHaveValue(15);
  expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled();
  expect(dispatchSiteSettingsUpdated).not.toHaveBeenCalled();
  expect(updateSiteSettings).not.toHaveBeenCalled();
});

it('does not publish a late response after switching away, including when returning to the original location', async () => {
  let finish!: (value: ShopSchedule) => void;
  vi.mocked(updateShopSchedule).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const view = render(<AdminSettings />);
  await userEvent.click(screen.getByRole('button', { name: '10 min' }));
  await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  state.localId = 'local-b';
  view.rerender(<AdminSettings />);
  expect(screen.getByRole('spinbutton', { name: 'Minutos' })).toHaveValue(0);
  state.localId = 'local-a';
  view.rerender(<AdminSettings />);
  expect(screen.getByRole('spinbutton', { name: 'Minutos' })).toHaveValue(0);
  await act(async () => finish({ ...state.schedules['local-a'], bufferMinutes: 10 }));
  expect(screen.getByRole('spinbutton', { name: 'Minutos' })).toHaveValue(0);
  expect(dispatchSiteSettingsUpdated).not.toHaveBeenCalled();
  expect(dispatchSchedulesUpdated).not.toHaveBeenCalled();
});

it('saves only the current general settings tab and retains drafts from the other tab', async () => {
  sessionStorage.setItem('admin-settings-active-tab', 'identity');
  vi.mocked(updateSiteSettings).mockImplementation(async (payload) => {
    state.settings[state.localId] = structuredClone(payload);
    return structuredClone(payload);
  });
  const original = structuredClone(state.settings['local-a']);
  render(<AdminSettings />);
  await userEvent.clear(screen.getByPlaceholderText('Le Blond Hair Salon'));
  await userEvent.type(screen.getByPlaceholderText('Le Blond Hair Salon'), 'Nombre sin publicar');
  await userEvent.clear(screen.getByPlaceholderText('656 610 045'));
  await userEvent.type(screen.getByPlaceholderText('656 610 045'), '600 123 456');
  await userEvent.click(screen.getByRole('tab', { name: 'Operativa' }));
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '12' } });
  await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  await waitFor(() => expect(updateSiteSettings).toHaveBeenCalledTimes(1));
  expect(vi.mocked(updateSiteSettings).mock.calls[0][0].branding).toEqual(original.branding);
  expect(vi.mocked(updateSiteSettings).mock.calls[0][0].contact).toEqual(original.contact);
  expect(vi.mocked(updateSiteSettings).mock.calls[0][0].appointments.cancellationCutoffHours).toBe(12);
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '18' } });
  await userEvent.click(screen.getByRole('tab', { name: 'Identidad y landing' }));
  expect(screen.getByPlaceholderText('Le Blond Hair Salon')).toHaveValue('Nombre sin publicar');
  expect(screen.getByPlaceholderText('656 610 045')).toHaveValue('600 123 456');
  await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  await waitFor(() => expect(updateSiteSettings).toHaveBeenCalledTimes(2));
  const identityPayload = vi.mocked(updateSiteSettings).mock.calls[1][0];
  expect(identityPayload.branding.name).toBe('Nombre sin publicar');
  expect(identityPayload.contact.phone).toBe('+34600123456');
  expect(identityPayload.appointments.cancellationCutoffHours).toBe(12);
  await userEvent.click(screen.getByRole('tab', { name: 'Operativa' }));
  expect(screen.getByRole('spinbutton')).toHaveValue(18);
  expect(updateShopSchedule).not.toHaveBeenCalled();
});

it('saving agenda does not publish or discard pending landing and operations changes', async () => {
  sessionStorage.setItem('admin-settings-active-tab', 'identity');
  vi.mocked(updateShopSchedule).mockImplementation(async (payload) => payload);
  const original = structuredClone(state.settings['local-a']);
  render(<AdminSettings />);
  fireEvent.change(screen.getByPlaceholderText('Le Blond Hair Salon'), { target: { value: 'Pendiente en landing' } });
  await userEvent.click(screen.getByRole('tab', { name: 'Operativa' }));
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '24' } });
  await userEvent.click(screen.getByRole('tab', { name: 'Agenda y horarios' }));
  await userEvent.click(screen.getByRole('button', { name: '10 min' }));
  await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Cambios guardados'));
  expect(updateSiteSettings).not.toHaveBeenCalled();
  const published = vi.mocked(dispatchSiteSettingsUpdated).mock.calls[0][0];
  expect(published.branding).toEqual(original.branding);
  expect(published.appointments).toEqual(original.appointments);
  await userEvent.click(screen.getByRole('tab', { name: 'Identidad y landing' }));
  expect(screen.getByPlaceholderText('Le Blond Hair Salon')).toHaveValue('Pendiente en landing');
  await userEvent.click(screen.getByRole('tab', { name: 'Operativa' }));
  expect(screen.getByRole('spinbutton')).toHaveValue(24);
});

it('keeps product preferences in the operations draft until saving that view', async () => {
  sessionStorage.setItem('admin-settings-active-tab', 'operations');
  vi.mocked(updateSiteSettings).mockImplementation(async (payload) => payload);
  const original = structuredClone(state.settings['local-a']);
  render(<AdminSettings />);
  await userEvent.click(screen.getByRole('switch', { name: es['admin.settings.products.clientPurchase.title'] }));
  expect(updateSiteSettings).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  await waitFor(() => expect(updateSiteSettings).toHaveBeenCalledOnce());
  const payload = vi.mocked(updateSiteSettings).mock.calls[0][0];
  expect(payload.products.clientPurchaseEnabled).toBe(!original.products.clientPurchaseEnabled);
  expect(payload.branding).toEqual(original.branding);
});
