import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ServicePresentationSettings from './ServicePresentationSettings';

vi.mock('@/hooks/useI18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

describe('ServicePresentationSettings', () => {
  it('lets an admin change service description visibility', () => {
    const onToggleDescriptions = vi.fn();

    render(
      <ServicePresentationSettings
        categoriesEnabled={false}
        disabled={false}
        onToggleCategories={vi.fn()}
        onToggleDescriptions={onToggleDescriptions}
        showDescriptions={false}
        uncategorizedCount={0}
      />,
    );

    fireEvent.click(screen.getByRole('switch', {
      name: 'admin.services.presentation.showDescriptions',
    }));

    expect(onToggleDescriptions).toHaveBeenCalledWith(true);
  });

  it('disables both presentation controls while settings are unavailable or saving', () => {
    render(
      <ServicePresentationSettings
        categoriesEnabled={false}
        disabled
        onToggleCategories={vi.fn()}
        onToggleDescriptions={vi.fn()}
        showDescriptions={false}
        uncategorizedCount={0}
      />,
    );

    expect(screen.getByRole('switch', {
      name: 'admin.services.presentation.groupByCategories',
    })).toBeDisabled();
    expect(screen.getByRole('switch', {
      name: 'admin.services.presentation.showDescriptions',
    })).toBeDisabled();
  });
});
