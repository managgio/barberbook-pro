import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PlatformSmsTenantSpend } from './PlatformSmsTenantSpend';
import { buildSmsTenantSpendRows } from './smsTenantSpendModel';

vi.mock('@/hooks/useI18n', () => ({
  useI18n: () => ({
    language: 'es',
    t: (key: string, values?: Record<string, string | number>) => (
      values ? `${key}:${Object.values(values).join(':')}` : key
    ),
  }),
}));

afterEach(cleanup);

describe('PlatformSmsTenantSpend', () => {
  const items = [
    { brandId: 'brand-b', brandName: 'Ronin', subdomain: 'ronin', costUsd: 2, messagesCount: 20 },
    { brandId: 'brand-a', brandName: 'Le Blond', subdomain: 'leblond', costUsd: 6, messagesCount: 40 },
    { brandId: 'brand-c', brandName: 'Norte', subdomain: 'norte', costUsd: 2, messagesCount: 10 },
  ];

  it('calculates and sorts every tenant share from the total SMS cost', () => {
    const result = buildSmsTenantSpendRows(items);

    expect(result.totalCostUsd).toBe(10);
    expect(result.totalMessages).toBe(70);
    expect(result.rows.map((row) => row.brandId)).toEqual(['brand-a', 'brand-b', 'brand-c']);
    expect(result.rows.map((row) => row.sharePercentage)).toEqual([60, 20, 20]);
  });

  it('renders every tenant with an accessible percentage bar', () => {
    render(
      <PlatformSmsTenantSpend
        items={items}
        isLoading={false}
        windowDays={7}
        displayCurrencyCode="USD"
      />,
    );

    expect(screen.getAllByText('Le Blond')).toHaveLength(2);
    expect(screen.getByText('Ronin')).toBeInTheDocument();
    expect(screen.getByText('Norte')).toBeInTheDocument();
    expect(screen.getAllByRole('progressbar')).toHaveLength(3);
    expect(screen.getByRole('progressbar', { name: /Le Blond/ })).toHaveAttribute('aria-valuenow', '60');
  });

  it('explains when SMS volume exists but cost is still unavailable', () => {
    render(
      <PlatformSmsTenantSpend
        items={[{ ...items[0], costUsd: 0 }]}
        isLoading={false}
        windowDays={7}
        displayCurrencyCode="USD"
      />,
    );

    expect(screen.getByText('platform.smsTenantSpend.costPending')).toBeInTheDocument();
    expect(screen.getByText('platform.smsTenantSpend.percentagePending')).toBeInTheDocument();
  });
});
