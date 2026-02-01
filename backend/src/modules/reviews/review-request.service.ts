import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus, ReviewFeedbackStatus, ReviewRequestStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getCurrentLocalId } from '../../tenancy/tenant.context';
import { ReviewConfigService } from './review-config.service';
import { ReviewActorDto } from './dto/review-actor.dto';

const isEmail = (value: string) => value.includes('@');

const parseGuestContact = (guestContact?: string | null) => {
  if (!guestContact) return { guestEmail: null, guestPhone: null };
  const trimmed = guestContact.trim();
  if (!trimmed) return { guestEmail: null, guestPhone: null };
  return isEmail(trimmed)
    ? { guestEmail: trimmed, guestPhone: null }
    : { guestEmail: null, guestPhone: trimmed };
};

const isFinalStatus = (status: ReviewRequestStatus) =>
  status === ReviewRequestStatus.COMPLETED ||
  status === ReviewRequestStatus.CLICKED ||
  status === ReviewRequestStatus.EXPIRED;

@Injectable()
export class ReviewRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ReviewConfigService,
  ) {}

  private requireActor(actor: ReviewActorDto) {
    const userId = actor.userId?.trim();
    const guestEmail = actor.guestEmail?.trim();
    const guestPhone = actor.guestPhone?.trim();
    if (!userId && !guestEmail && !guestPhone) {
      throw new BadRequestException('userId o contacto del invitado es requerido.');
    }
    return { userId: userId || null, guestEmail: guestEmail || null, guestPhone: guestPhone || null };
  }

  private buildActorWhere(actor: { userId: string | null; guestEmail: string | null; guestPhone: string | null }) {
    if (actor.userId) return { userId: actor.userId };
    if (actor.guestEmail) return { guestEmail: actor.guestEmail };
    if (actor.guestPhone) return { guestPhone: actor.guestPhone };
    return {};
  }

  private async getRequestOrThrow(id: string, actor: ReviewActorDto) {
    const localId = getCurrentLocalId();
    const actorInfo = this.requireActor(actor);
    const request = await this.prisma.reviewRequest.findFirst({
      where: { id, localId, ...this.buildActorWhere(actorInfo) },
    });
    if (!request) throw new NotFoundException('Review request not found');
    return request;
  }

  async handleAppointmentCompleted(appointmentId: string) {
    const localId = getCurrentLocalId();
    const config = await this.configService.getConfig();
    if (!config.enabled || !config.googleReviewUrl) return null;

    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, localId },
      select: { id: true, userId: true, guestContact: true, status: true, startDateTime: true },
    });
    if (!appointment || appointment.status !== AppointmentStatus.completed) return null;

    const existing = await this.prisma.reviewRequest.findFirst({ where: { appointmentId } });
    if (existing) return existing;

    const contact = parseGuestContact(appointment.guestContact);
    const hasActor = Boolean(appointment.userId || contact.guestEmail || contact.guestPhone);
    if (!hasActor) return null;

    const completedCount = appointment.userId
      ? await this.prisma.appointment.count({
          where: { localId, userId: appointment.userId, status: AppointmentStatus.completed },
        })
      : await this.prisma.appointment.count({
          where: {
            localId,
            status: AppointmentStatus.completed,
            guestContact: appointment.guestContact ?? undefined,
          },
        });

    if (completedCount < config.minVisitsToAsk) return null;

    const cutoff = new Date(Date.now() - config.cooldownDays * 24 * 60 * 60 * 1000);
    const recent = await this.prisma.reviewRequest.findFirst({
      where: {
        localId,
        createdAt: { gte: cutoff },
        ...(appointment.userId
          ? { userId: appointment.userId }
          : contact.guestEmail
          ? { guestEmail: contact.guestEmail }
          : { guestPhone: contact.guestPhone ?? undefined }),
      },
      select: { id: true },
    });

    if (recent) return null;

    const eligibleAt = new Date(Date.now() + config.showDelayMinutes * 60 * 1000);

    return this.prisma.reviewRequest.create({
      data: {
        localId,
        appointmentId: appointment.id,
        userId: appointment.userId ?? null,
        guestEmail: contact.guestEmail,
        guestPhone: contact.guestPhone,
        status: ReviewRequestStatus.PENDING,
        eligibleAt,
      },
    });
  }

  async getPendingReview(actor: ReviewActorDto) {
    const localId = getCurrentLocalId();
    const config = await this.configService.getConfig();
    if (!config.enabled || !config.googleReviewUrl) return null;

    const actorInfo = this.requireActor(actor);
    const now = new Date();

    const request = await this.prisma.reviewRequest.findFirst({
      where: {
        localId,
        eligibleAt: { lte: now },
        status: { in: [ReviewRequestStatus.PENDING, ReviewRequestStatus.ELIGIBLE, ReviewRequestStatus.DISMISSED] },
        ...this.buildActorWhere(actorInfo),
      },
      orderBy: { eligibleAt: 'asc' },
    });

    if (!request) return null;

    if (request.status === ReviewRequestStatus.DISMISSED && request.snoozeCount >= config.maxSnoozes) {
      await this.prisma.reviewRequest.update({
        where: { id: request.id },
        data: { status: ReviewRequestStatus.EXPIRED, completedAt: new Date() },
      });
      return null;
    }

    const shouldPromote = request.status === ReviewRequestStatus.PENDING;
    if (shouldPromote) {
      await this.prisma.reviewRequest.update({
        where: { id: request.id },
        data: { status: ReviewRequestStatus.ELIGIBLE },
      });
    }

    return {
      id: request.id,
      status: shouldPromote ? ReviewRequestStatus.ELIGIBLE : request.status,
      rating: request.rating,
      eligibleAt: request.eligibleAt,
      snoozeCount: request.snoozeCount,
      copy: config.copyJson,
      googleReviewUrl: config.googleReviewUrl,
    };
  }

  async markShown(id: string, actor: ReviewActorDto) {
    const request = await this.getRequestOrThrow(id, actor);
    if (request.shownAt) return request;
    if (isFinalStatus(request.status)) {
      return request;
    }
    return this.prisma.reviewRequest.update({
      where: { id: request.id },
      data: { status: ReviewRequestStatus.SHOWN, shownAt: new Date() },
    });
  }

  async rate(id: string, rating: number, actor: ReviewActorDto) {
    const request = await this.getRequestOrThrow(id, actor);
    if (isFinalStatus(request.status)) {
      throw new BadRequestException('La solicitud ya está finalizada.');
    }

    const updated = await this.prisma.reviewRequest.update({
      where: { id: request.id },
      data: {
        rating,
        ratedAt: new Date(),
        status: ReviewRequestStatus.RATED,
      },
    });

    const config = await this.configService.getConfig();
    if (rating >= 4) {
      return {
        next: 'GOOGLE',
        googleReviewUrl: config.googleReviewUrl,
        ctaText: config.copyJson.positiveCta,
        message: config.copyJson.positiveText,
      };
    }
    return {
      next: 'FEEDBACK',
      ctaText: config.copyJson.negativeCta,
      message: config.copyJson.negativeText,
    };
  }

  async submitFeedback(id: string, text: string, actor: ReviewActorDto) {
    const request = await this.getRequestOrThrow(id, actor);
    if (!request.rating || request.rating > 3) {
      throw new BadRequestException('La valoración no es elegible para feedback.');
    }
    if (isFinalStatus(request.status)) {
      throw new BadRequestException('La solicitud ya está finalizada.');
    }

    return this.prisma.reviewRequest.update({
      where: { id: request.id },
      data: {
        privateFeedback: text.trim(),
        feedbackStatus: ReviewFeedbackStatus.OPEN,
        status: ReviewRequestStatus.COMPLETED,
        completedAt: new Date(),
      },
    });
  }

  async markClicked(id: string, actor: ReviewActorDto) {
    const request = await this.getRequestOrThrow(id, actor);
    if (isFinalStatus(request.status)) {
      return request;
    }
    return this.prisma.reviewRequest.update({
      where: { id: request.id },
      data: {
        status: ReviewRequestStatus.CLICKED,
        clickedAt: new Date(),
        completedAt: new Date(),
      },
    });
  }

  async snooze(id: string, actor: ReviewActorDto) {
    const request = await this.getRequestOrThrow(id, actor);
    if (isFinalStatus(request.status)) {
      return request;
    }

    const config = await this.configService.getConfig();
    if (config.maxSnoozes <= 0) {
      return this.prisma.reviewRequest.update({
        where: { id: request.id },
        data: { status: ReviewRequestStatus.EXPIRED, completedAt: new Date() },
      });
    }

    const nextCount = request.snoozeCount + 1;
    if (nextCount > config.maxSnoozes) {
      return this.prisma.reviewRequest.update({
        where: { id: request.id },
        data: { snoozeCount: nextCount, status: ReviewRequestStatus.EXPIRED, completedAt: new Date() },
      });
    }

    const eligibleAt = new Date(Date.now() + config.snoozeHours * 60 * 60 * 1000);
    return this.prisma.reviewRequest.update({
      where: { id: request.id },
      data: {
        snoozeCount: nextCount,
        status: ReviewRequestStatus.DISMISSED,
        eligibleAt,
      },
    });
  }
}
