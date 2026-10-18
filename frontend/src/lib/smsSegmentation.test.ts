import { describe, expect, it } from 'vitest';

import { analyzeSmsSegmentation } from './smsSegmentation';

describe('SMS segmentation', () => {
  it('uses GSM-7 single and concatenated limits', () => {
    expect(analyzeSmsSegmentation('a'.repeat(160))).toMatchObject({
      encoding: 'GSM-7',
      units: 160,
      segments: 1,
    });
    expect(analyzeSmsSegmentation('a'.repeat(161)).segments).toBe(2);
  });

  it('counts GSM-7 extension characters as two septets', () => {
    expect(analyzeSmsSegmentation('{'.repeat(80))).toMatchObject({ units: 160, segments: 1 });
    expect(analyzeSmsSegmentation('{'.repeat(81))).toMatchObject({ units: 162, segments: 2 });
  });

  it('uses UTF-16 code units and UCS-2 limits for non-GSM content', () => {
    expect(analyzeSmsSegmentation('🙂'.repeat(35))).toMatchObject({
      encoding: 'UCS-2',
      units: 70,
      segments: 1,
    });
    expect(analyzeSmsSegmentation('🙂'.repeat(36)).segments).toBe(2);
  });

  it('detects Unicode messages that exceed three provider segments under 280 characters', () => {
    expect(analyzeSmsSegmentation('á'.repeat(202))).toMatchObject({
      encoding: 'UCS-2',
      segments: 4,
    });
  });
});
