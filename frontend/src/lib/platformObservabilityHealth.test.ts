import { describe, expect, it } from 'vitest';

import { getWebVitalHealth } from '@/lib/platformObservabilityHealth';

describe('getWebVitalHealth', () => {
  it('keeps a metric healthy when its p75 is good even if isolated samples may be poor', () => {
    expect(getWebVitalHealth({ name: 'LCP', p75: 2_100 })).toBe('ok');
  });

  it('marks a metric as warning when p75 needs improvement', () => {
    expect(getWebVitalHealth({ name: 'INP', p75: 250 })).toBe('warning');
  });

  it('marks a metric as critical only when p75 crosses the poor threshold', () => {
    expect(getWebVitalHealth({ name: 'CLS', p75: 0.3 })).toBe('critical');
  });
});
