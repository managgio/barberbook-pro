import 'reflect-metadata';
import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateReviewConfigDto } from '@/modules/reviews/dto/update-review-config.dto';
import { parseReviewMetricsRange, ReviewFeedbackQueryDto } from '@/modules/reviews/dto/review-query.dto';

test('review copy validates nested fields, URL protocol and numeric bounds', async () => {
  const check = (data: unknown) => validate(plainToInstance(UpdateReviewConfigDto, data), { whitelist: true, forbidNonWhitelisted: true });
  assert.equal((await check({ enabled: true, googleReviewUrl: ' https://g.page/example/review ', copyJson: { title: 'Visita' } })).length, 0);
  for (const invalid of [{ copyJson: { title: 4 } }, { copyJson: { title: 'x'.repeat(141) } }, { copyJson: { unexpected: 'x' } }, { googleReviewUrl: 'javascript:alert(1)' }, { cooldownDays: 100000 }, { localId: 'other' }]) assert.ok((await check(invalid)).length);
});

test('metrics dates include the entire local day and reject invalid/inverted ranges', () => {
  const range = parseReviewMetricsRange('2026-10-18', '2026-10-18', 'Europe/Madrid');
  assert.equal(range.from?.toISOString(), '2026-10-17T22:00:00.000Z');
  assert.equal(range.to?.toISOString(), '2026-10-18T21:59:59.999Z');
  const dst = parseReviewMetricsRange('2026-10-25', '2026-10-25', 'Europe/Madrid');
  assert.equal(dst.to!.getTime() - dst.from!.getTime() + 1, 25 * 3_600_000);
  for (const dates of [['invalid', undefined], ['2026-02-30', undefined], ['2026-10-20', '2026-10-18']]) assert.throws(() => parseReviewMetricsRange(dates[0], dates[1], 'Europe/Madrid'));
});

test('feedback status and pagination reject malformed input', async () => {
  for (const data of [{ status: 'invalid' }, { page: '-1' }, { page: '1oops' }, { pageSize: '1000' }]) assert.ok((await validate(plainToInstance(ReviewFeedbackQueryDto, data))).length);
  assert.equal((await validate(plainToInstance(ReviewFeedbackQueryDto, { status: 'OPEN', page: '2', pageSize: '20' }))).length, 0);
});
