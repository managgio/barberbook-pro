import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import PublicServiceDescription from './PublicServiceDescription';

describe('PublicServiceDescription', () => {
  it('hides descriptions unless the tenant explicitly enables them', () => {
    render(
      <PublicServiceDescription
        description="A tailored service description"
        visible={false}
      />,
    );

    expect(screen.queryByText('A tailored service description')).not.toBeInTheDocument();
  });

  it('shows an enabled non-empty description', () => {
    render(
      <PublicServiceDescription
        description="  A tailored service description  "
        visible
      />,
    );

    expect(screen.getByText('A tailored service description')).toBeInTheDocument();
  });

  it('does not render empty descriptions', () => {
    const { container } = render(
      <PublicServiceDescription description="   " visible />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
