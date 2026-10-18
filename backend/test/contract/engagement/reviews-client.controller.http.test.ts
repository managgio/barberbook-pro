import 'reflect-metadata';
import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { Test } from '@nestjs/testing';
import { UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { ReviewsClientController } from '@/modules/reviews/reviews.client.controller';
import { ReviewRequestService } from '@/modules/reviews/review-request.service';
import { AuthService } from '@/auth/auth.service';

test('every review endpoint authenticates and ignores forged user/contact identity', async () => {
  const calls: Array<{ action: string; actor: unknown }> = [];
  const action = (name: string) => async (...args: unknown[]) => { calls.push({ action: name, actor: args.at(-1) }); return { ok: true }; };
  const module = await Test.createTestingModule({ controllers: [ReviewsClientController], providers: [
    { provide: ReviewRequestService, useValue: Object.fromEntries(['getPendingReview', 'markShown', 'rate', 'submitFeedback', 'markClicked', 'snooze'].map(name => [name, action(name)])) },
    { provide: AuthService, useValue: { requireUser: async (req: { headers: Record<string, string> }) => {
      if (req.headers.authorization !== 'Bearer valid-session') throw new UnauthorizedException();
      return { id: 'authenticated-owner' };
    } } },
  ] }).compile();
  const app = module.createNestApplication({ logger: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(0, '127.0.0.1');
  try {
    const base = await app.getUrl();
    for (const [path, method, body] of [
      ['/reviews/pending?userId=victim&guestEmail=other@example.test', 'GET', undefined],
      ...['shown', 'rate', 'feedback', 'click', 'snooze'].map<[string, string, Record<string, unknown>]>(action => [`/reviews/request/${action}`, 'POST', { userId: 'victim', guestEmail: 'other@example.test', ...(action === 'rate' ? { rating: 1 } : action === 'feedback' ? { text: 'Comentario' } : {}) }]),
    ] as const) {
      const options = { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined };
      assert.equal((await fetch(base + path, options)).status, 401);
      const response = await fetch(base + path, { ...options, headers: { ...options.headers, authorization: 'Bearer valid-session' } });
      assert.ok(response.ok, await response.text());
      assert.deepEqual(calls.at(-1)?.actor, { userId: 'authenticated-owner' });
    }
    assert.equal(calls.length, 6);
    const invalid = await fetch(base + '/reviews/request/rate', { method: 'POST', headers: { authorization: 'Bearer valid-session', 'content-type': 'application/json' }, body: JSON.stringify({ rating: 6 }) });
    assert.equal(invalid.status, 400);
  } finally { await app.close(); }
});
