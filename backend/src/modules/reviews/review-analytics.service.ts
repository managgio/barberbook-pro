import { Injectable, NotFoundException } from '@nestjs/common';
import { ReviewFeedbackStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getCurrentLocalId } from '../../tenancy/tenant.context';

const buildDateFilter = (from?: Date, to?: Date) => {
  if (!from && !to) return undefined;
  return {
    gte: from,
    lte: to,
  } as const;
};

@Injectable()
export class ReviewAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(params?: { from?: Date; to?: Date }) {
    const localId = getCurrentLocalId();
    const createdRange = buildDateFilter(params?.from, params?.to);

    const [createdCount, shownCount, ratedCount, googleClicksCount, feedbackCount] = await Promise.all([
      this.prisma.reviewRequest.count({
        where: { localId, ...(createdRange ? { createdAt: createdRange } : {}) },
      }),
      this.prisma.reviewRequest.count({
        where: { localId, ...(createdRange ? { shownAt: createdRange } : { shownAt: { not: null } }) },
      }),
      this.prisma.reviewRequest.count({
        where: { localId, ...(createdRange ? { ratedAt: createdRange } : { ratedAt: { not: null } }) },
      }),
      this.prisma.reviewRequest.count({
        where: { localId, ...(createdRange ? { clickedAt: createdRange } : { clickedAt: { not: null } }) },
      }),
      this.prisma.reviewRequest.count({
        where: {
          localId,
          privateFeedback: { not: null },
          rating: { lte: 3 },
          ...(createdRange ? { completedAt: createdRange } : {}),
        },
      }),
    ]);

    const conversionRate = shownCount > 0 ? Number((googleClicksCount / shownCount).toFixed(4)) : 0;

    return {
      createdCount,
      shownCount,
      ratedCount,
      googleClicksCount,
      feedbackCount,
      conversionRate,
    };
  }

  async listFeedback(params: { status?: ReviewFeedbackStatus; page: number; pageSize: number }) {
    const localId = getCurrentLocalId();
    const where = {
      localId,
      privateFeedback: { not: null },
      rating: { lte: 3 },
      ...(params.status ? { feedbackStatus: params.status } : {}),
    } as const;

    const [total, items] = await Promise.all([
      this.prisma.reviewRequest.count({ where }),
      this.prisma.reviewRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        include: {
          appointment: {
            select: {
              id: true,
              startDateTime: true,
              service: { select: { name: true } },
              barber: { select: { name: true } },
              user: { select: { name: true, email: true, phone: true } },
              guestName: true,
              guestContact: true,
            },
          },
        },
      }),
    ]);

    const mapped = items.map((item) => ({
      id: item.id,
      rating: item.rating,
      privateFeedback: item.privateFeedback,
      feedbackStatus: item.feedbackStatus,
      status: item.status,
      createdAt: item.createdAt,
      appointmentId: item.appointmentId,
      appointmentDate: item.appointment?.startDateTime ?? null,
      serviceName: item.appointment?.service?.name ?? null,
      barberName: item.appointment?.barber?.name ?? null,
      clientName: item.appointment?.user?.name ?? item.appointment?.guestName ?? null,
      clientEmail: item.appointment?.user?.email ?? null,
      clientPhone: item.appointment?.user?.phone ?? null,
      guestContact: item.appointment?.guestContact ?? null,
    }));

    return { total, items: mapped };
  }

  async resolveFeedback(id: string) {
    const localId = getCurrentLocalId();
    const request = await this.prisma.reviewRequest.findFirst({ where: { id, localId }, select: { id: true } });
    if (!request) throw new NotFoundException('Review request not found');
    return this.prisma.reviewRequest.update({
      where: { id: request.id },
      data: { feedbackStatus: ReviewFeedbackStatus.RESOLVED },
    });
  }
}
