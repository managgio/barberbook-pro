import { describe, expect, it } from 'vitest';

import { formatCriticalTraceBreadcrumbs } from '@/lib/criticalTracePresentation';

describe('formatCriticalTraceBreadcrumbs', () => {
  it('formats the compact trail with relative timing', () => {
    const result = formatCriticalTraceBreadcrumbs({
      breadcrumbs: JSON.stringify([
        { stage: 'booking_flow', elapsedMs: 0 },
        { stage: 'confirmation_rendered', elapsedMs: 1_250 },
      ]),
    });

    expect(result).toBe('booking_flow (+0 ms) → confirmation_rendered (+1.3 s)');
  });

  it('ignores malformed trail metadata', () => {
    expect(formatCriticalTraceBreadcrumbs({ breadcrumbs: '{invalid' })).toBeNull();
  });
});
