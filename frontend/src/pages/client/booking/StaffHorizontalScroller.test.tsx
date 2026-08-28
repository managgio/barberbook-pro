import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import StaffHorizontalScroller from './StaffHorizontalScroller';

describe('StaffHorizontalScroller', () => {
  it('contains multiple professionals in an accessible horizontal scroller', () => {
    render(
      <StaffHorizontalScroller scrollable label="Professionals">
        <button type="button">Alex</button>
        <button type="button">Sam</button>
      </StaffHorizontalScroller>,
    );

    const scroller = screen.getByRole('region', { name: 'Professionals' });

    expect(scroller).toHaveClass(
      'min-w-0',
      'max-w-full',
      'w-full',
      'overflow-x-auto',
      'overscroll-x-contain',
      'snap-x',
    );
    expect(scroller).toHaveAttribute('tabindex', '0');
  });

  it('does not create a scroll region for a single professional', () => {
    const { container } = render(
      <StaffHorizontalScroller scrollable={false} label="Professionals">
        <button type="button">Alex</button>
      </StaffHorizontalScroller>,
    );

    const scroller = container.firstElementChild;

    expect(scroller).not.toHaveAttribute('role');
    expect(scroller).not.toHaveAttribute('tabindex');
    expect(scroller).not.toHaveClass('overflow-x-auto');
  });
});
