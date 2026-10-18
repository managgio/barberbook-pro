import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { PrismaClient } from '@prisma/client';
import { PrismaReviewManagementAdapter } from '@/modules/reviews/adapters/prisma-review-management.adapter';
import { RequestContext } from '@/shared/application/request-context';

const url = process.env.REVIEWS_TEST_DATABASE_URL;
test('review transactions isolate tenants/owners, serialize cooldown and preserve the last snooze and final states', { skip: !url }, async () => {
  const parsed = new URL(url!);
  assert.ok(['localhost', '127.0.0.1'].includes(parsed.hostname) && parsed.pathname.startsWith('/managgio_reviews_test'), 'Use an isolated local review test database.');
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const suffix = randomUUID();
  try {
    const brand = await prisma.brand.create({ data: { name: 'Review QA', subdomain: `review-${suffix}` } });
    const local = await prisma.location.create({ data: { brandId: brand.id, name: 'Review A' } });
    const foreign = await prisma.location.create({ data: { brandId: brand.id, name: 'Review B' } });
    const user = await prisma.user.create({ data: { name: 'Review user', email: `${suffix}@example.test` } });
    const other = await prisma.user.create({ data: { name: 'Other user', email: `other-${suffix}@example.test` } });
    const barber = await prisma.barber.create({ data: { localId: local.id, name: 'Professional', specialty: 'Hair', startDate: new Date() } });
    const service = await prisma.service.create({ data: { localId: local.id, name: 'Haircut', description: '', price: 10, duration: 30 } });
    const context: RequestContext = { tenantId: brand.id, brandId: brand.id, localId: local.id, timezone: 'Europe/Madrid', actorUserId: null, correlationId: 'review-integration' };
    let moduleEnabled = true;
    const adapter = (localId = local.id) => new PrismaReviewManagementAdapter(prisma as any, {
      getEffectiveConfig: async () => ({ adminSidebar: { hiddenSections: moduleEnabled ? [] : ['reviews'] } }),
    } as any, { getRequestContext: () => ({ ...context, localId }) } as any);
    const reviews = adapter();
    const actor = { userId: user.id };
    await reviews.updateConfig({ enabled: true, googleReviewUrl: 'https://g.page/salon/review', minVisitsToAsk: 1, showDelayMinutes: 0, maxSnoozes: 1 });
    const appointment = (userId: string | null, guestEmail?: string) => prisma.appointment.create({ data: {
      localId: local.id, userId, guestEmail, barberId: barber.id, serviceId: service.id, startDateTime: new Date(), price: 10, status: 'completed',
    } });
    const [first, second] = await Promise.all([appointment(user.id), appointment(user.id)]);
    const attempts = await Promise.all([reviews.handleAppointmentCompleted(first.id), reviews.handleAppointmentCompleted(first.id), reviews.handleAppointmentCompleted(second.id)]);
    assert.equal(await prisma.reviewRequest.count({ where: { localId: local.id, userId: user.id } }), 1);
    assert.ok(attempts.some(Boolean));
    const pending = (await reviews.getPendingReview(actor))!;
    assert.ok(pending);
    assert.equal(await reviews.getPendingReview({ userId: other.id }), null);
    await adapter(foreign.id).updateConfig({ enabled: true, googleReviewUrl: 'https://g.page/other/review' });
    assert.equal(await adapter(foreign.id).getPendingReview(actor), null);
    await assert.rejects(() => adapter(foreign.id).rate(pending.id, 5, actor));
    await assert.rejects(() => reviews.rate(pending.id, 5, { userId: other.id }));
    await reviews.markShown(pending.id, actor);
    assert.equal((await reviews.getPendingReview(actor))?.status, 'SHOWN');
    assert.equal((await reviews.rate(pending.id, 1, actor)).next, 'GOOGLE');
    assert.equal((await reviews.getPendingReview(actor))?.rating, 1);
    await Promise.all([reviews.snooze(pending.id, actor), reviews.snooze(pending.id, actor)]);
    let stored = (await prisma.reviewRequest.findFirst({ where: { id: pending.id, localId: local.id } }))!;
    assert.equal(stored.snoozeCount, 1);
    assert.equal(stored.status, 'DISMISSED');
    assert.equal(await reviews.getPendingReview(actor), null);
    await prisma.reviewRequest.update({ where: { id: pending.id, localId: local.id }, data: { eligibleAt: new Date(Date.now() - 1000) } });
    assert.equal((await reviews.getPendingReview(actor))?.id, pending.id);
    await reviews.markShown(pending.id, actor);
    const race = await Promise.allSettled([reviews.markClicked(pending.id, actor), reviews.rate(pending.id, 5, actor), reviews.markShown(pending.id, actor)]);
    assert.equal(race[0].status, 'fulfilled');
    stored = (await prisma.reviewRequest.findFirst({ where: { id: pending.id, localId: local.id } }))!;
    assert.equal(stored.status, 'CLICKED');
    assert.ok(stored.clickedAt);
    assert.equal(await reviews.getPendingReview(actor), null);

    const third = await appointment(other.id);
    const otherRequest = (await reviews.handleAppointmentCompleted(third.id))!;
    await reviews.rate(otherRequest.id, 5, { userId: other.id });
    await Promise.all([reviews.submitFeedback(otherRequest.id, 'Muy bien', { userId: other.id }), reviews.submitFeedback(otherRequest.id, 'Muy bien', { userId: other.id })]);
    assert.equal((await reviews.listFeedback({ status: 'OPEN', page: 1, pageSize: 20 })).total, 1);
    await reviews.resolveFeedback(otherRequest.id);
    assert.equal((await reviews.listFeedback({ status: 'OPEN', page: 1, pageSize: 20 })).total, 0);
    const metrics = await reviews.getMetrics({ from: new Date(Date.now() - 60_000), to: new Date(Date.now() + 60_000) });
    assert.equal(metrics.feedbackCount, 1);
    assert.equal(metrics.googleClicksCount, 1);
    assert.equal(metrics.conversionRate, 0.5);

    const guest = await appointment(null, `guest-${suffix}@example.test`);
    const guestRequest = (await reviews.handleAppointmentCompleted(guest.id))!;
    assert.ok(guestRequest);
    const guestRow = await prisma.reviewRequest.findFirst({ where: { id: guestRequest.id, localId: local.id } });
    assert.equal(guestRow?.guestEmail, `guest-${suffix}@example.test`);
    await assert.rejects(() => reviews.getPendingReview({ guestEmail: guestRow!.guestEmail! }));

    moduleEnabled = false;
    assert.equal(await reviews.getPendingReview(actor), null);
    assert.equal(await reviews.handleAppointmentCompleted(guest.id), null);
    await assert.rejects(() => reviews.markClicked(pending.id, actor));
    moduleEnabled = true;
    await reviews.updateConfig({ enabled: false });
    assert.equal(await reviews.getPendingReview(actor), null);
    await assert.rejects(() => reviews.rate(pending.id, 1, actor));
  } finally { await prisma.$disconnect(); }
});
