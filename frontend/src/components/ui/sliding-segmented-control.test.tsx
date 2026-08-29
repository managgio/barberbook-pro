import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

import SlidingSegmentedControl from './sliding-segmented-control';

const offsetLeftSpy = vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function () {
  const index = Number(this.getAttribute('data-segment-index') || 0);
  return 4 + index * 100;
});
const offsetTopSpy = vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockReturnValue(4);
const offsetWidthSpy = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(92);
const offsetHeightSpy = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(32);

afterEach(cleanup);

afterAll(() => {
  offsetLeftSpy.mockRestore();
  offsetTopSpy.mockRestore();
  offsetWidthSpy.mockRestore();
  offsetHeightSpy.mockRestore();
});

describe('SlidingSegmentedControl', () => {
  it('moves its indicator and exposes the selected option', () => {
    const Example = () => {
      const [value, setValue] = React.useState('manual');
      return (
        <SlidingSegmentedControl
          ariaLabel="Movement type"
          value={value}
          onValueChange={setValue}
          options={[
            { value: 'manual', label: 'Manual' },
            { value: 'products', label: 'Products' },
          ]}
        />
      );
    };

    render(<Example />);

    const indicator = screen.getByTestId('segmented-control-sliding-indicator');
    expect(indicator).toHaveStyle({ transform: 'translate3d(4px, 4px, 0)' });
    expect(screen.getByRole('button', { name: 'Manual' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Products' }));

    expect(indicator).toHaveStyle({ transform: 'translate3d(104px, 4px, 0)' });
    expect(screen.getByRole('button', { name: 'Products' })).toHaveAttribute('aria-pressed', 'true');
  });
});
