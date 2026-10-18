import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { ReviewSnapshot, reviewTransition } from '@/contexts/engagement/domain/services/review-request-policy';
import { DomainError } from '@/shared/domain/domain-error';

const now = new Date('2026-10-18T12:00:00Z');
const config = { maxSnoozes: 1, snoozeHours: 48 };
const request = (overrides: Partial<ReviewSnapshot> = {}): ReviewSnapshot => ({
  status: 'SHOWN', rating: null, privateFeedback: null, snoozeCount: 0,
  eligibleAt: new Date('2026-10-18T11:00:00Z'), shownAt: now, ratedAt: null, clickedAt: null, completedAt: null, ...overrides,
});

test('the final permitted snooze is shown again before expiry; retries do not consume another snooze', () => {
  const snoozed = { ...request(), ...reviewTransition(request(), { type: 'snooze' }, config, now) };
  assert.equal(snoozed.status, 'DISMISSED');
  assert.equal(snoozed.snoozeCount, 1);
  assert.deepEqual(reviewTransition(snoozed, { type: 'snooze' }, config, now), {});
  const later = new Date('2026-10-20T12:00:01Z');
  const shown = { ...snoozed, ...reviewTransition(snoozed, { type: 'shown' }, config, later) };
  assert.equal(shown.status, 'SHOWN');
  assert.equal(reviewTransition(shown, { type: 'snooze' }, config, later).status, 'EXPIRED');
});

test('shown retries preserve a rating; a rated snooze resumes the rated step', () => {
  const rated = request({ status: 'RATED', rating: 2, ratedAt: now });
  assert.equal(reviewTransition(rated, { type: 'shown' }, config, now).status, 'RATED');
  const snoozed = { ...rated, ...reviewTransition(rated, { type: 'snooze' }, config, now) };
  assert.equal(reviewTransition(snoozed, { type: 'shown' }, config, snoozed.eligibleAt).status, 'RATED');
});

test('every rating can open Google or submit private feedback without selective solicitation', () => {
  for (let rating = 1; rating <= 5; rating++) {
    const rated = request({ rating, status: 'RATED' });
    assert.equal(reviewTransition(rated, { type: 'click' }, config, now).status, 'CLICKED');
    assert.equal(reviewTransition(rated, { type: 'feedback', text: '  Mi comentario  ' }, config, now).privateFeedback, 'Mi comentario');
  }
});

test('final states cannot regress; completed feedback and Google click retries are idempotent', () => {
  const clicked = request({ status: 'CLICKED', rating: 1, clickedAt: now, completedAt: now });
  for (const type of ['shown', 'snooze', 'click'] as const) assert.deepEqual(reviewTransition(clicked, { type }, config, now), {});
  assert.throws(() => reviewTransition(clicked, { type: 'rate', rating: 5 }, config, now), (e: unknown) => e instanceof DomainError && e.code === 'REVIEW_FINALIZED');
  const completed = request({ status: 'COMPLETED', rating: 5, privateFeedback: 'Gracias', completedAt: now });
  assert.deepEqual(reviewTransition(completed, { type: 'feedback', text: 'Gracias' }, config, now), {});
  assert.deepEqual(reviewTransition(completed, { type: 'click' }, config, now), { clickedAt: now });
});

test('future eligibility, invalid ratings and empty/oversized feedback cannot be bypassed', () => {
  const future = request({ eligibleAt: new Date('2030-01-01') });
  assert.throws(() => reviewTransition(future, { type: 'rate', rating: 5 }, config, now));
  for (const rating of [0, 6, 2.5, NaN]) assert.throws(() => reviewTransition(request(), { type: 'rate', rating }, config, now));
  for (const text of ['   ', 'ab', 'x'.repeat(2001)]) assert.throws(() => reviewTransition(request({ rating: 1 }), { type: 'feedback', text }, config, now));
  assert.throws(() => reviewTransition(request(), { type: 'click' }, config, now));
  assert.equal(reviewTransition(request(), { type: 'snooze' }, { ...config, maxSnoozes: 0 }, now).status, 'EXPIRED');
});
