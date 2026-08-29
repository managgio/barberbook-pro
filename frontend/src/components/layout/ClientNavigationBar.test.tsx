import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

import ClientNavigationBar from './ClientNavigationBar';
import { CLIENT_NAV_ITEMS } from './clientNavItems';

const offsetLeftSpy = vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function () {
  const index = Number(this.getAttribute('data-nav-index') || 0);
  return 4 + index * 100;
});
const offsetTopSpy = vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockReturnValue(4);
const offsetWidthSpy = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(92);
const offsetHeightSpy = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(32);

const translate = (key: string) => key;
const items = CLIENT_NAV_ITEMS.slice(0, 3);

afterEach(cleanup);

afterAll(() => {
  offsetLeftSpy.mockRestore();
  offsetTopSpy.mockRestore();
  offsetWidthSpy.mockRestore();
  offsetHeightSpy.mockRestore();
});

describe('ClientNavigationBar', () => {
  it('slides one shared indicator to the active client route', () => {
    const view = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ClientNavigationBar items={items} pathname="/app" translate={translate} />
      </MemoryRouter>,
    );

    const indicator = screen.getByTestId('client-nav-sliding-indicator');
    expect(indicator).toHaveStyle({
      width: '92px',
      height: '32px',
      transform: 'translate3d(4px, 4px, 0)',
    });
    expect(screen.getByRole('link', { name: 'clientNav.dashboard' })).toHaveAttribute('aria-current', 'page');

    view.rerender(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ClientNavigationBar items={items} pathname="/app/appointments" translate={translate} />
      </MemoryRouter>,
    );

    expect(indicator).toHaveStyle({ transform: 'translate3d(104px, 4px, 0)' });
    expect(screen.getByRole('link', { name: 'clientNav.appointments' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByTestId('client-nav-sliding-indicator')).toHaveLength(1);
  });

  it('exposes a translated navigation label and reduced-motion behavior', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ClientNavigationBar items={items} pathname="/app" translate={translate} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('navigation', { name: 'clientNav.ariaLabel' })).toBeInTheDocument();
    expect(screen.getByTestId('client-nav-sliding-indicator')).toHaveClass('motion-reduce:transition-none');
  });
});
