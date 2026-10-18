import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeSmsSegmentation } from '@/contexts/engagement/domain/services/sms-segmentation.policy';

test('GSM-7 segmentation uses 160 septets for one message and 153 for concatenated messages', () => {
  assert.deepEqual(analyzeSmsSegmentation('a'.repeat(160)), {
    encoding: 'GSM-7',
    units: 160,
    segments: 1,
    singleSegmentLimit: 160,
    concatenatedSegmentLimit: 153,
  });
  assert.equal(analyzeSmsSegmentation('a'.repeat(161)).segments, 2);
  assert.equal(analyzeSmsSegmentation('a'.repeat(306)).segments, 2);
  assert.equal(analyzeSmsSegmentation('a'.repeat(307)).segments, 3);
  assert.equal(analyzeSmsSegmentation('^'.repeat(80)).units, 160);
});

test('UCS-2 segmentation counts UTF-16 units and applies 70/67 limits', () => {
  assert.deepEqual(analyzeSmsSegmentation('á'.repeat(70)), {
    encoding: 'UCS-2',
    units: 70,
    segments: 1,
    singleSegmentLimit: 70,
    concatenatedSegmentLimit: 67,
  });
  assert.equal(analyzeSmsSegmentation('á'.repeat(71)).segments, 2);
  assert.equal(analyzeSmsSegmentation('á'.repeat(134)).segments, 2);
  assert.equal(analyzeSmsSegmentation('á'.repeat(135)).segments, 3);
  assert.equal(analyzeSmsSegmentation('✂️'.repeat(40)).encoding, 'UCS-2');
  assert.equal(analyzeSmsSegmentation('✂️'.repeat(40)).units, 80);
});
