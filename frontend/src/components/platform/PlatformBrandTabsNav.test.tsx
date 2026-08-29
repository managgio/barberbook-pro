import { cleanup, render, screen } from '@testing-library/react';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { Tabs } from '@/components/ui/tabs';
import PlatformBrandTabsNav from './PlatformBrandTabsNav';

const offsetLeftSpy = vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function () {
  const index = Number(this.getAttribute('data-tab-index') || 0);
  return 4 + index * 100;
});
const offsetTopSpy = vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockReturnValue(4);
const offsetWidthSpy = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(92);
const offsetHeightSpy = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(32);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

afterAll(() => {
  offsetLeftSpy.mockRestore();
  offsetTopSpy.mockRestore();
  offsetWidthSpy.mockRestore();
  offsetHeightSpy.mockRestore();
});

describe('PlatformBrandTabsNav', () => {
  it('moves one shared indicator to the active tab', () => {
    const view = render(
      <Tabs value="datos">
        <PlatformBrandTabsNav activeTab="datos" />
      </Tabs>,
    );

    const indicator = screen.getByTestId('platform-brand-tab-indicator');
    expect(indicator).toHaveStyle({
      width: '92px',
      height: '32px',
      transform: 'translate3d(4px, 4px, 0)',
    });
    expect(screen.getByRole('tab', { name: 'Datos' })).toHaveAttribute('data-state', 'active');

    view.rerender(
      <Tabs value="landing">
        <PlatformBrandTabsNav activeTab="landing" />
      </Tabs>,
    );

    expect(indicator).toHaveStyle({ transform: 'translate3d(404px, 4px, 0)' });
    expect(screen.getByRole('tab', { name: 'Landing' })).toHaveAttribute('data-state', 'active');
    expect(screen.getAllByTestId('platform-brand-tab-indicator')).toHaveLength(1);
  });

  it('keeps reduced-motion support on the indicator transition', () => {
    render(
      <Tabs value="datos">
        <PlatformBrandTabsNav activeTab="datos" />
      </Tabs>,
    );

    expect(screen.getByTestId('platform-brand-tab-indicator')).toHaveClass('motion-reduce:transition-none');
  });
});
