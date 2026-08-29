import { Injectable, Logger } from '@nestjs/common';
import { NotificationDeliveryChannel, NotificationDeliveryKind } from '@prisma/client';
import { EngagementNotificationDeliveryResult } from '../../contexts/engagement/ports/outbound/notification-management.port';
import { CriticalTraceLevel, CriticalTraceOutcome } from '../../contexts/platform/domain/entities/platform-observability.entity';
import { PrismaService } from '../../prisma/prisma.service';
import { ObservabilityService } from '../observability/observability.service';

type CriticalDelivery = {
  id: string;
  brandId: string;
  localId: string;
  appointmentId: string | null;
  channel: NotificationDeliveryChannel;
  kind: NotificationDeliveryKind;
  attemptCount: number;
  criticalTraceReportedAt: Date | null;
};

@Injectable()
export class NotificationDeliveryCriticalReporter {
  private readonly logger = new Logger(NotificationDeliveryCriticalReporter.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly observabilityService: ObservabilityService,
  ) {}

  async report(
    delivery: CriticalDelivery,
    result: Extract<EngagementNotificationDeliveryResult, { status: 'failed' }>,
    now: Date,
  ) {
    if (delivery.criticalTraceReportedAt) return;
    const marked = await this.prisma.notificationDelivery.updateMany({
      where: { id: delivery.id, criticalTraceReportedAt: null },
      data: { criticalTraceReportedAt: now },
    });
    if (marked.count !== 1) return;
    try {
      await this.observabilityService.recordCriticalTrace(
        {
          traceId: `notification:${delivery.id}`,
          category: 'notification_delivery',
          stage: 'delivery_failed',
          level: CriticalTraceLevel.ERROR,
          outcome: CriticalTraceOutcome.FAILED,
          path: 'background/notification-outbox',
          appointmentId: delivery.appointmentId || undefined,
          message: result.message,
          errorName: 'NotificationDeliveryError',
          errorCode: result.code,
          metadata: { channel: delivery.channel, kind: delivery.kind, attempts: delivery.attemptCount },
        },
        { brandId: delivery.brandId, localId: delivery.localId, user: null },
      );
    } catch (error) {
      await this.prisma.notificationDelivery.updateMany({
        where: { id: delivery.id, criticalTraceReportedAt: now },
        data: { criticalTraceReportedAt: null },
      });
      this.logger.error(
        `Critical notification trace persistence failed deliveryId=${delivery.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
