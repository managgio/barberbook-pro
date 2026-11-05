import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { DEFAULT_SITE_SETTINGS } from '@/data/salonInfo';
import es from '@/i18n/locales/es.json';
import type { ShopSchedule } from '@/data/types';
import AgendaSettings from './AgendaSettings';

vi.mock('@/hooks/useI18n', () => ({ useI18n: () => ({
  language: 'es', t: (key: string, values: Record<string, string | number> = {}) =>
    Object.entries(values).reduce((text, [name, value]) => text.split('{' + name + '}').join(String(value)), (es as Record<string, string>)[key] ?? key),
}) }));
vi.mock('@/lib/businessCopy', () => ({ useBusinessCopy: () => ({ staff: { fromWithDefinitePlural: 'del equipo' } }) }));
afterEach(cleanup);

const source = () => {
  const value = structuredClone(DEFAULT_SITE_SETTINGS.openingHours);
  value.bufferMinutes = 0;
  value.endOverflowMinutes = 15;
  value.endOverflowByDay = { friday: 0 };
  return value;
};
const props = (value = source()) => ({
  localId: 'local-a', schedule: value, openingHours: value, isLoading: false, isSaving: false,
  loadFailed: false, onRetry: vi.fn(), onSave: vi.fn(async (next: ShopSchedule) => next),
});

it('opens clear section help with the keyboard without expanding or editing the section', async () => {
  const current = props();
  render(<AgendaSettings {...current} />);
  for (const [title, explanation] of [
    ['Tiempo entre citas', 'Deja unos minutos libres después de cada cita para limpiar, preparar o descansar. Ese tiempo no se puede reservar.'],
    ['Descansos de la agenda', 'Bloquea ratos sin reservas para todo el equipo. Puedes repetirlos cada semana o elegir una fecha concreta.'],
    ['Cierre y excepciones', 'Permite que una cita termine después del cierre. Elige cuántos minutos extra aceptas y, si lo necesitas, un margen distinto para un día concreto.'],
  ]) {
    const trigger = screen.getByRole('button', { name: 'Información sobre ' + title });
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    const help = screen.getByRole('dialog', { name: title });
    expect(within(help).getByText(explanation)).toBeInTheDocument();
    expect(within(help).getByText(/Por ejemplo:/)).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  }
  expect(screen.getByRole('button', { name: 'Descansos de la agenda' })).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getByRole('button', { name: 'Cierre y excepciones' })).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
  expect(current.onSave).not.toHaveBeenCalled();
});

it('shows a compact week and opens a day with the keyboard without exposing exceptions initially', async () => {
  render(<AgendaSettings {...props()} />);
  expect(screen.getByRole('button', { name: /Lunes.*Editar/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Domingo.*Editar/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Cierre y excepciones' })).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getByRole('button', { name: 'Descansos de la agenda' })).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
  expect(screen.queryByLabelText(/Inicio Lunes/)).not.toBeInTheDocument();
  const day = screen.getByRole('button', { name: /Lunes.*Editar/ });
  day.focus();
  await userEvent.keyboard('{Enter}');
  expect(day).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByLabelText('Inicio Lunes Mañana')).toBeInTheDocument();
  expect(day).toHaveFocus();
});

it('copies hours only after choosing and confirming destination days', async () => {
  const onSave = vi.fn(async (next: ShopSchedule) => next);
  const value = source();
  value.monday.closed = false;
  value.monday.morning = { enabled: true, start: '08:00', end: '12:00' };
  render(<AgendaSettings {...props(value)} onSave={onSave} />);
  await userEvent.click(screen.getByRole('button', { name: /Lunes.*Editar/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Copiar a otros días' }));
  const dialog = screen.getByRole('alertdialog');
  expect(within(dialog).getByRole('button', { name: 'Confirmar copia (0)' })).toBeDisabled();
  await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Martes' }));
  expect(onSave).not.toHaveBeenCalled();
  await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar copia (1)' }));
  expect(screen.getByRole('button', { name: /Martes.*08:00 - 12:00/ })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  expect(onSave).toHaveBeenCalledTimes(1);
  expect(onSave.mock.calls[0][0].tuesday).toEqual(value.monday);
  expect(onSave.mock.calls[0][0].endOverflowByDay?.friday).toBe(0);
});

it('keeps edited values after rejection and background refresh, and discards to the latest server version', async () => {
  const current = props();
  current.onSave.mockRejectedValueOnce(new Error('No se pudo guardar'));
  const view = render(<AgendaSettings {...current} />);
  await userEvent.click(screen.getByRole('button', { name: '10 min' }));
  await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  expect(await screen.findByText('No se pudo guardar')).toBeInTheDocument();
  expect(screen.getByRole('spinbutton', { name: 'Minutos' })).toHaveValue(10);
  const refreshed = source();
  refreshed.bufferMinutes = 5;
  view.rerender(<AgendaSettings {...current} schedule={refreshed} openingHours={refreshed} />);
  expect(screen.getByRole('spinbutton', { name: 'Minutos' })).toHaveValue(10);
  await userEvent.click(screen.getByRole('button', { name: 'Descartar cambios' }));
  expect(screen.getByRole('spinbutton', { name: 'Minutos' })).toHaveValue(5);
  expect(screen.queryByText('No se pudo guardar')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
});

it('preserves exact zero overrides and requires confirmation before removing them', async () => {
  render(<AgendaSettings {...props()} />);
  await userEvent.click(screen.getByRole('button', { name: 'Cierre y excepciones' }));
  expect(screen.getByRole('spinbutton', { name: 'Viernes' })).toHaveValue(0);
  await userEvent.click(screen.getByRole('button', { name: 'Quitar excepción de Viernes' }));
  const dialog = screen.getByRole('alertdialog');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
  expect(screen.getByRole('spinbutton', { name: 'Viernes' })).toHaveValue(0);
  await userEvent.click(screen.getByRole('button', { name: 'Quitar excepción de Viernes' }));
  await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Quitar' }));
  expect(screen.queryByRole('spinbutton', { name: 'Viernes' })).not.toBeInTheDocument();
});

it('blocks invalid hours and disables editing throughout a save', async () => {
  const current = props();
  const view = render(<AgendaSettings {...current} />);
  await userEvent.click(screen.getByRole('button', { name: /Lunes.*Editar/ }));
  const open = screen.getByRole('switch', { name: 'Abrir el Lunes' });
  if (open.getAttribute('aria-checked') === 'false') await userEvent.click(open);
  fireEvent.change(screen.getByLabelText('Inicio Lunes Mañana'), { target: { value: '23:00' } });
  expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
  expect(screen.getByText('Revisa los horarios o minutos señalados antes de guardar.')).toBeInTheDocument();
  view.rerender(<AgendaSettings {...current} isSaving />);
  expect(screen.getByLabelText('Inicio Lunes Mañana')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Descansos de la agenda' })).toBeDisabled();
});

it('clears the draft on location change and ignores a late save response from the previous location', async () => {
  let finish!: (value: ShopSchedule) => void;
  const current = props();
  current.onSave.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const view = render(<AgendaSettings {...current} />);
  await userEvent.click(screen.getByRole('button', { name: '10 min' }));
  await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  const next = source();
  next.bufferMinutes = 5;
  view.rerender(<AgendaSettings {...current} localId="local-b" schedule={next} openingHours={next} />);
  expect(screen.getByRole('spinbutton', { name: 'Minutos' })).toHaveValue(5);
  await act(async () => finish({ ...source(), bufferMinutes: 10 }));
  expect(screen.getByRole('spinbutton', { name: 'Minutos' })).toHaveValue(5);
  expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
});

it('shows a retry action instead of a perpetual spinner when loading fails', async () => {
  const current = props();
  render(<AgendaSettings {...current} schedule={undefined} openingHours={undefined} isLoading={false} loadFailed />);
  expect(screen.getByRole('alert')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(current.onRetry).toHaveBeenCalledOnce();
  expect(current.onSave).not.toHaveBeenCalled();
});

it('does not expose cached hours or editing controls after permissions are revoked', () => {
  const current = props();
  const view = render(<AgendaSettings {...current} />);
  view.rerender(<AgendaSettings {...current} permissionDenied loadFailed />);
  expect(screen.getByRole('alert')).toHaveTextContent('No tienes permiso para consultar o modificar estos horarios.');
  expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Guardar cambios' })).not.toBeInTheDocument();
});

it('keeps weekly and date-specific breaks together in the existing schedule payload', async () => {
  const current = props();
  render(<AgendaSettings {...current} />);
  await userEvent.click(screen.getByRole('button', { name: 'Descansos de la agenda' }));
  await userEvent.click(screen.getByRole('button', { name: /Lunes.*Sin descansos/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Añadir descanso' }));
  fireEvent.change(screen.getByLabelText('Nueva fecha'), { target: { value: '2026-11-10' } });
  await userEvent.click(screen.getByRole('button', { name: 'Añadir fecha' }));
  await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  await screen.findByText('Cambios guardados');
  const payload = current.onSave.mock.calls[0][0];
  expect(payload.breaks?.monday).toEqual([{ start: '13:30', end: '14:00' }]);
  expect(payload.breaksByDate?.['2026-11-10']).toEqual([{ start: '13:30', end: '14:00' }]);
  expect(payload.endOverflowByDay?.friday).toBe(0);
});
