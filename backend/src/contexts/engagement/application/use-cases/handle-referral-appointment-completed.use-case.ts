import { parseEngagementContactTokens } from '../../domain/services/referral-contact';
import { endOfMonth, formatReferralRewardText, startOfMonth } from '../../domain/services/referral-rewarding';
import { EngagementReferralNotificationPort } from '../../ports/outbound/referral-notification.port';
import { EngagementReferralAttributionPersistencePort } from '../../ports/outbound/referral-attribution-persistence.port';
import { EngagementReferralRewardPort } from '../../ports/outbound/referral-reward.port';

const ALLOWED_PENDING_STATUSES = new Set(['ATTRIBUTED', 'BOOKED']);

export class HandleReferralAppointmentCompletedUseCase {
  constructor(
    private readonly persistence: EngagementReferralAttributionPersistencePort,
    private readonly rewardPort: EngagementReferralRewardPort,
    private readonly notificationPort: EngagementReferralNotificationPort,
  ) {}

  async execute(params: { localId: string; appointmentId: string; now?: Date }): Promise<void> {
    const now = params.now ?? new Date();
    const appointment = await this.persistence.findAppointmentForReferralCompletion({
      localId: params.localId,
      appointmentId: params.appointmentId,
    });
    if (!appointment || appointment.status !== 'completed') return;
    if (!appointment.referralAttributionId) return;

    const attribution = await this.persistence.findAttributionById({
      localId: params.localId,
      attributionId: appointment.referralAttributionId,
    });
    if (!attribution) return;
    if (!ALLOWED_PENDING_STATUSES.has(attribution.status)) return;
    if (attribution.firstAppointmentId && attribution.firstAppointmentId !== appointment.id) return;

    const config = await this.persistence.getActiveReferralConfig();
    if (!config) return;

    if (config.allowedServiceIds && !config.allowedServiceIds.includes(appointment.serviceId)) {
      await this.persistence.updateAttributionStatus({
        attributionId: attribution.id,
        status: 'VOIDED',
        metadataReason: 'service_not_allowed',
      });
      return;
    }

    if (config.newCustomerOnly) {
      const contact = parseEngagementContactTokens(appointment.guestContact ?? null);
      const hasPrevious = await this.persistence.findPreviousCompletedCustomerAppointment({
        localId: params.localId,
        beforeDate: appointment.startDateTime,
        userId: appointment.userId,
        email: contact.email,
        phone: contact.phone,
      });
      if (hasPrevious) {
        await this.persistence.updateAttributionStatus({
          attributionId: attribution.id,
          status: 'VOIDED',
          metadataReason: 'not_new_customer',
        });
        return;
      }
    }

    if (config.monthlyMaxRewardsPerReferrer) {
      const rewardedCount = await this.persistence.countRewardedAttributionsByReferrer({
        localId: params.localId,
        referrerUserId: attribution.referrerUserId,
        from: startOfMonth(now),
        to: endOfMonth(now),
      });
      if (rewardedCount >= config.monthlyMaxRewardsPerReferrer) {
        await this.persistence.updateAttributionStatus({
          attributionId: attribution.id,
          status: 'VOIDED',
          metadataReason: 'monthly_limit',
        });
        return;
      }
    }

    await this.persistence.updateAttributionStatus({
      attributionId: attribution.id,
      status: 'COMPLETED',
    });

    const referrerText = formatReferralRewardText({
      type: config.rewardReferrerType,
      value: config.rewardReferrerValue,
      serviceName: config.rewardReferrerServiceName,
    });
    const referredText = formatReferralRewardText({
      type: config.rewardReferredType,
      value: config.rewardReferredValue,
      serviceName: config.rewardReferredServiceName,
    });

    await this.persistence.runInTransaction(async (tx) => {
      await this.rewardPort.issueReward({
        userId: attribution.referrerUserId,
        referralAttributionId: attribution.id,
        rewardType: config.rewardReferrerType,
        rewardValue: config.rewardReferrerValue,
        rewardServiceId: config.rewardReferrerServiceId,
        description: `Recompensa por referido completado (${referrerText}).`,
        tx,
      });

      if (attribution.referredUserId) {
        await this.rewardPort.issueReward({
          userId: attribution.referredUserId,
          referralAttributionId: attribution.id,
          rewardType: config.rewardReferredType,
          rewardValue: config.rewardReferredValue,
          rewardServiceId: config.rewardReferredServiceId,
          description: `Recompensa de bienvenida (${referredText}).`,
          tx,
        });
      }

      await this.persistence.updateAttributionStatus({
        attributionId: attribution.id,
        status: 'REWARDED',
        tx,
      });
    });

    const users = await this.persistence.findUsersByIds({
      ids: [attribution.referrerUserId, attribution.referredUserId].filter(Boolean) as string[],
    });
    const userMap = new Map(users.map((user) => [user.id, user]));
    const referrer = userMap.get(attribution.referrerUserId);
    const referred = attribution.referredUserId ? userMap.get(attribution.referredUserId) : null;

    if (referrer?.email && referrer.notificationEmail !== false) {
      await this.notificationPort.sendRewardEmail({
        name: referrer.name,
        email: referrer.email,
        title: 'Recompensa desbloqueada 🎉',
        message: 'Tu invitado completó su primera visita. Recompensa desbloqueada 🎉',
      });
    }

    if (referred?.email && referred.notificationEmail !== false) {
      await this.notificationPort.sendRewardEmail({
        name: referred.name,
        email: referred.email,
        title: 'Tu recompensa ya está disponible',
        message: '¡Bienvenido! Has desbloqueado tu recompensa. Ya puedes usarla en tu próxima cita.',
      });
    }
  }
}
