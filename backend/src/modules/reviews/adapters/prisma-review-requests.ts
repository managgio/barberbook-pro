import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EngagementReviewConfigPayload } from '../../../contexts/engagement/ports/outbound/review-management.port';
import { ACTIVE_REVIEW_STATES, ReviewAction, reviewTransition } from '../../../contexts/engagement/domain/services/review-request-policy';
import { PrismaService } from '../../../prisma/prisma.service';
import { RequestContext } from '../../../shared/application/request-context';

// Transport responses never include customer contact details or internal notes.
export const reviewPublicSelect = {
  id: true, status: true, rating: true, eligibleAt: true, snoozeCount: true,
} satisfies Prisma.ReviewRequestSelect;

export class PrismaReviewRequests {
  constructor(private readonly prisma: PrismaService) {}

  createForAppointment(context: RequestContext, appointmentId: string, config: EngagementReviewConfigPayload) {
    return this.prisma.$transaction(async (tx) => {
      // Serializes eligibility/cooldown checks, including two different appointments of the same customer.
      const locations = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM Location WHERE id = ${context.localId} AND brandId = ${context.brandId} FOR UPDATE
      `;
      if (locations.length !== 1) return null;
      const localId = context.localId;
      const appointment = await tx.appointment.findFirst({
        where: { id: appointmentId, localId, status: 'completed' },
        select: { id: true, userId: true, guestContact: true, guestEmail: true, guestPhone: true },
      });
      if (!appointment) return null;
      const existing = await tx.reviewRequest.findFirst({ where: { appointmentId, localId }, select: reviewPublicSelect });
      if (existing) return existing;
      const legacy = appointment.guestContact?.trim();
      const guestEmail = appointment.guestEmail?.trim() || (legacy?.includes('@') ? legacy : null);
      const guestPhone = appointment.guestPhone?.trim() || (legacy && !legacy.includes('@') ? legacy : null);
      if (!appointment.userId && !guestEmail && !guestPhone) return null;
      const actor = appointment.userId ? { userId: appointment.userId } : guestEmail ? { userId: null, guestEmail } : { userId: null, guestPhone };
      const guestVisits: Prisma.AppointmentWhereInput[] = guestEmail
        ? [{ guestEmail }, { guestEmail: null, guestContact: guestEmail }]
        : [{ guestPhone }, { guestPhone: null, guestContact: guestPhone }];
      const visits = await tx.appointment.count({ where: {
        localId, status: 'completed',
        ...(appointment.userId ? { userId: appointment.userId } : { userId: null, OR: guestVisits }),
      } });
      if (visits < config.minVisitsToAsk) return null;
      const now = new Date();
      const recent = await tx.reviewRequest.findFirst({ where: {
        localId, ...actor, createdAt: { gte: new Date(now.getTime() - config.cooldownDays * 86_400_000) },
      }, select: { id: true } });
      if (recent) return null;
      return tx.reviewRequest.create({ data: {
        localId, appointmentId, userId: appointment.userId, guestEmail, guestPhone,
        eligibleAt: new Date(now.getTime() + config.showDelayMinutes * 60_000),
      }, select: reviewPublicSelect });
    });
  }

  pending(localId: string, userId: string, config: EngagementReviewConfigPayload) {
    return this.prisma.reviewRequest.findFirst({
      where: { localId, userId, eligibleAt: { lte: new Date() }, status: { in: ACTIVE_REVIEW_STATES },
        appointment: { localId, status: 'completed' },
        OR: [{ status: { not: 'DISMISSED' } }, { snoozeCount: { lte: config.maxSnoozes } }],
      },
      orderBy: [{ eligibleAt: 'asc' }, { id: 'asc' }], select: reviewPublicSelect,
    });
  }

  transition(localId: string, userId: string, id: string, action: ReviewAction, config: EngagementReviewConfigPayload) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM ReviewRequest WHERE id = ${id} AND localId = ${localId} AND userId = ${userId} FOR UPDATE
      `;
      if (rows.length !== 1) throw new NotFoundException('Review request not found');
      const where = { id, localId, userId, appointment: { localId, status: 'completed' as const } };
      const request = await tx.reviewRequest.findFirst({ where });
      if (!request) throw new NotFoundException('Review request not found');
      const data = reviewTransition(request, action, config, new Date());
      return tx.reviewRequest.update({ where: { id, localId, userId }, data, select: reviewPublicSelect });
    });
  }
}
