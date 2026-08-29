import { cleanup, render, screen } from '@testing-library/react';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

import { Tabs, TabsList, TabsTrigger } from './tabs';

const offsetLeftSpy = vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function () {
  return this.getAttribute('data-state') === 'active' ? 8 : 108;
});
const offsetTopSpy = vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockReturnValue(4);
const offsetWidthSpy = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(96);
const offsetHeightSpy = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(32);

afterEach(cleanup);

afterAll(() => {
  offsetLeftSpy.mockRestore();
  offsetTopSpy.mockRestore();
  offsetWidthSpy.mockRestore();
  offsetHeightSpy.mockRestore();
});

describe('TabsList sliding indicator', () => {
  it('is inherited by standard application tabs', () => {
    render(
      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
        </TabsList>
      </Tabs>,
    );

    const indicator = screen.getByTestId('tabs-sliding-indicator');
    expect(indicator).toHaveStyle({
      width: '96px',
      height: '32px',
      transform: 'translate3d(8px, 4px, 0)',
    });
    expect(indicator).toHaveClass('motion-reduce:transition-none');
  });
});
