import { Module } from '@nestjs/common';
import { AnonymizeAppointmentUseCase } from '../../contexts/booking/application/use-cases/anonymize-appointment.use-case';
import { CreateAppointmentUseCase } from '../../contexts/booking/application/use-cases/create-appointment.use-case';
import { GetAvailabilityBatchUseCase } from '../../contexts/booking/application/use-cases/get-availability-batch.use-case';
import { GetAvailabilityUseCase } from '../../contexts/booking/application/use-cases/get-availability.use-case';
import { GetBookingDashboardSummaryUseCase } from '../../contexts/booking/application/use-cases/get-booking-dashboard-summary.use-case';
import { SendAppointmentPaymentConfirmationUseCase } from '../../contexts/booking/application/use-cases/send-appointment-payment-confirmation.use-case';
import { FindAppointmentsPageWithClientsUseCase } from '../../contexts/booking/application/use-cases/find-appointments-page-with-clients.use-case';
import { FindAppointmentsPageUseCase } from '../../contexts/booking/application/use-cases/find-appointments-page.use-case';
import { FindAppointmentByIdUseCase } from '../../contexts/booking/application/use-cases/find-appointment-by-id.use-case';
import { FindAppointmentsRangeWithClientsUseCase } from '../../contexts/booking/application/use-cases/find-appointments-range-with-clients.use-case';
import { GetWeeklyLoadUseCase } from '../../contexts/booking/application/use-cases/get-weekly-load.use-case';
import { RemoveAppointmentUseCase } from '../../contexts/booking/application/use-cases/remove-appointment.use-case';
import { RunAppointmentStatusSideEffectsUseCase } from '../../contexts/booking/application/use-cases/run-appointment-status-side-effects.use-case';
import { SyncAppointmentStatusesUseCase } from '../../contexts/booking/application/use-cases/sync-appointment-statuses.use-case';
import { UpdateAppointmentUseCase } from '../../contexts/booking/application/use-cases/update-appointment.use-case';
import { AttachReferralAttributionToAppointmentUseCase } from '../../contexts/engagement/application/use-cases/attach-referral-attribution-to-appointment.use-case';
import { HandleReferralAppointmentCancelledUseCase } from '../../contexts/engagement/application/use-cases/handle-referral-appointment-cancelled.use-case';
import { HandleReferralAppointmentCompletedUseCase } from '../../contexts/engagement/application/use-cases/handle-referral-appointment-completed.use-case';
import { BookingWalletLedgerUseCase } from '../../contexts/commerce/application/use-cases/booking-wallet-ledger.use-case';
import { ResolveLoyaltyRewardDecisionUseCase } from '../../contexts/commerce/application/use-cases/resolve-loyalty-reward-decision.use-case';
import { ResolveReferralAttributionForBookingUseCase } from '../../contexts/engagement/application/use-cases/resolve-referral-attribution-for-booking.use-case';
import {
  BOOKING_COMMAND_PORT,
  BookingCommandPort,
} from '../../contexts/booking/ports/outbound/booking-command.port';
import {
  BOOKING_IDEMPOTENCY_PORT,
  BookingIdempotencyPort,
} from '../../contexts/booking/ports/outbound/booking-idempotency.port';
import {
  BOOKING_MAINTENANCE_PORT,
  BookingMaintenancePort,
} from '../../contexts/booking/ports/outbound/booking-maintenance.port';
import {
  BOOKING_STATUS_SIDE_EFFECTS_PORT,
  BookingStatusSideEffectsPort,
} from '../../contexts/booking/ports/outbound/booking-status-side-effects.port';
import {
  BOOKING_UNIT_OF_WORK_PORT,
  BookingUnitOfWorkPort,
} from '../../contexts/booking/ports/outbound/booking-unit-of-work.port';
import {
  BARBER_ELIGIBILITY_READ_PORT,
  BarberEligibilityReadPort,
} from '../../contexts/booking/ports/outbound/barber-eligibility-read.port';
import {
  BOOKING_AVAILABILITY_READ_PORT,
  BookingAvailabilityReadPort,
} from '../../contexts/booking/ports/outbound/booking-availability-read.port';
import {
  BOOKING_DASHBOARD_READ_PORT,
  BookingDashboardReadPort,
} from '../../contexts/booking/ports/outbound/booking-dashboard-read.port';
import {
  BOOKING_APPOINTMENT_QUERY_PORT,
  BookingAppointmentQueryPort,
} from '../../contexts/booking/ports/outbound/booking-appointment-query.port';
import { HOLIDAY_READ_PORT, HolidayReadPort } from '../../contexts/booking/ports/outbound/holiday-read.port';
import {
  SCHEDULE_POLICY_READ_PORT,
  SchedulePolicyReadPort,
} from '../../contexts/booking/ports/outbound/schedule-read.port';
import {
  SERVICE_CATALOG_READ_PORT,
  ServiceCatalogReadPort,
} from '../../contexts/booking/ports/outbound/service-read.port';
import { PrismaBarberEligibilityReadAdapter } from '../../contexts/booking/infrastructure/prisma/prisma-barber-eligibility-read.adapter';
import { PrismaBookingAvailabilityReadAdapter } from '../../contexts/booking/infrastructure/prisma/prisma-booking-availability-read.adapter';
import { PrismaHolidayReadAdapter } from '../../contexts/booking/infrastructure/prisma/prisma-holiday-read.adapter';
import { PrismaSchedulePolicyReadAdapter } from '../../contexts/booking/infrastructure/prisma/prisma-schedule-policy-read.adapter';
import { PrismaServiceCatalogReadAdapter } from '../../contexts/booking/infrastructure/prisma/prisma-service-catalog-read.adapter';
import { DistributedLockBookingIdempotencyAdapter } from '../../contexts/booking/infrastructure/adapters/distributed-lock-booking-idempotency.adapter';
import { NoopBookingUnitOfWorkAdapter } from '../../contexts/booking/infrastructure/adapters/noop-booking-unit-of-work.adapter';
import { PrismaCommerceLoyaltyPolicyAdapter } from '../../contexts/commerce/infrastructure/adapters/prisma-commerce-loyalty-policy.adapter';
import { PrismaCommerceWalletLedgerAdapter } from '../../contexts/commerce/infrastructure/adapters/prisma-commerce-wallet-ledger.adapter';
import { PrismaCommerceLoyaltyPolicyReadAdapter } from '../../contexts/commerce/infrastructure/prisma/prisma-commerce-loyalty-policy-read.adapter';
import { PrismaServicePricingPolicyAdapter } from '../../contexts/commerce/infrastructure/prisma/prisma-service-pricing-policy.adapter';
import { PrismaWalletLedgerPersistenceAdapter } from '../../contexts/commerce/infrastructure/prisma/prisma-wallet-ledger-persistence.adapter';
import { EngagementReferralAttributionAdapter } from '../../contexts/engagement/infrastructure/adapters/engagement-referral-attribution.adapter';
import { ENGAGEMENT_REFERRAL_ATTRIBUTION_PORT } from '../../contexts/engagement/ports/outbound/referral-attribution.port';
import { ENGAGEMENT_REFERRAL_NOTIFICATION_PORT, EngagementReferralNotificationPort } from '../../contexts/engagement/ports/outbound/referral-notification.port';
import {
  ENGAGEMENT_REFERRAL_ATTRIBUTION_PERSISTENCE_PORT,
  EngagementReferralAttributionPersistencePort,
} from '../../contexts/engagement/ports/outbound/referral-attribution-persistence.port';
import { ENGAGEMENT_REFERRAL_REWARD_PORT, EngagementReferralRewardPort } from '../../contexts/engagement/ports/outbound/referral-reward.port';
import { COMMERCE_LOYALTY_POLICY_PORT } from '../../contexts/commerce/ports/outbound/loyalty-policy.port';
import {
  COMMERCE_LOYALTY_POLICY_READ_PORT,
  CommerceLoyaltyPolicyReadPort,
} from '../../contexts/commerce/ports/outbound/loyalty-policy-read.port';
import { COMMERCE_SERVICE_PRICING_PORT } from '../../contexts/commerce/ports/outbound/service-pricing.port';
import {
  COMMERCE_SUBSCRIPTION_POLICY_PORT,
  CommerceSubscriptionPolicyPort,
} from '../../contexts/commerce/ports/outbound/subscription-policy.port';
import { COMMERCE_WALLET_LEDGER_PORT } from '../../contexts/commerce/ports/outbound/wallet-ledger.port';
import {
  COMMERCE_WALLET_LEDGER_PERSISTENCE_PORT,
  CommerceWalletLedgerPersistencePort,
} from '../../contexts/commerce/ports/outbound/wallet-ledger-persistence.port';
import { AppointmentsStatusSyncService } from './appointments-status-sync.service';
import { AppointmentsRetentionService } from './appointments-retention.service';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsFacade } from './appointments.facade';
import { HolidaysModule } from '../holidays/holidays.module';
import { SchedulesModule } from '../schedules/schedules.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LegalModule } from '../legal/legal.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { SettingsModule } from '../settings/settings.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { AuthModule } from '../../auth/auth.module';
import { BarbersModule } from '../barbers/barbers.module';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { ModuleBookingCommandAdapter } from './adapters/module-booking-command.adapter';
import { ModuleBookingMaintenanceAdapter } from './adapters/module-booking-maintenance.adapter';
import { ModuleBookingStatusSideEffectsAdapter } from './adapters/module-booking-status-side-effects.adapter';
import { PrismaBookingAppointmentQueryAdapter } from './adapters/prisma-booking-appointment-query.adapter';
import { PrismaBookingDashboardReadAdapter } from './adapters/prisma-booking-dashboard-read.adapter';
import { ModuleEngagementReferralNotificationAdapter } from '../notifications/adapters/module-engagement-referral-notification.adapter';
import { ModuleEngagementReferralAttributionPersistenceAdapter } from '../referrals/adapters/module-engagement-referral-attribution-persistence.adapter';
import { ModuleEngagementReferralRewardAdapter } from '../referrals/adapters/module-engagement-referral-reward.adapter';
import { SubscriptionsCommerceSubscriptionPolicyModule } from '../subscriptions/subscriptions-commerce-subscription-policy.module';
import { CLOCK_PORT, ClockPort } from '../../shared/application/clock.port';
import { SystemClockAdapter } from '../../shared/infrastructure/clock/system-clock.adapter';

@Module({
  imports: [
    HolidaysModule,
    SchedulesModule,
    NotificationsModule,
    LegalModule,
    AuditLogsModule,
    SettingsModule,
    ReferralsModule,
    ReviewsModule,
    AuthModule,
    BarbersModule,
    TenancyModule,
    SubscriptionsCommerceSubscriptionPolicyModule,
  ],
  controllers: [AppointmentsController],
  providers: [
    AppointmentsFacade,
    AppointmentsStatusSyncService,
    AppointmentsRetentionService,
    { provide: CLOCK_PORT, useClass: SystemClockAdapter },
    { provide: BOOKING_AVAILABILITY_READ_PORT, useClass: PrismaBookingAvailabilityReadAdapter },
    { provide: BOOKING_DASHBOARD_READ_PORT, useClass: PrismaBookingDashboardReadAdapter },
    { provide: BOOKING_APPOINTMENT_QUERY_PORT, useClass: PrismaBookingAppointmentQueryAdapter },
    { provide: SCHEDULE_POLICY_READ_PORT, useClass: PrismaSchedulePolicyReadAdapter },
    { provide: HOLIDAY_READ_PORT, useClass: PrismaHolidayReadAdapter },
    { provide: BARBER_ELIGIBILITY_READ_PORT, useClass: PrismaBarberEligibilityReadAdapter },
    { provide: SERVICE_CATALOG_READ_PORT, useClass: PrismaServiceCatalogReadAdapter },
    { provide: BOOKING_COMMAND_PORT, useClass: ModuleBookingCommandAdapter },
    { provide: BOOKING_UNIT_OF_WORK_PORT, useClass: NoopBookingUnitOfWorkAdapter },
    { provide: BOOKING_MAINTENANCE_PORT, useClass: ModuleBookingMaintenanceAdapter },
    { provide: BOOKING_STATUS_SIDE_EFFECTS_PORT, useClass: ModuleBookingStatusSideEffectsAdapter },
    { provide: BOOKING_IDEMPOTENCY_PORT, useClass: DistributedLockBookingIdempotencyAdapter },
    { provide: COMMERCE_SERVICE_PRICING_PORT, useClass: PrismaServicePricingPolicyAdapter },
    { provide: COMMERCE_LOYALTY_POLICY_READ_PORT, useClass: PrismaCommerceLoyaltyPolicyReadAdapter },
    { provide: COMMERCE_LOYALTY_POLICY_PORT, useClass: PrismaCommerceLoyaltyPolicyAdapter },
    { provide: COMMERCE_WALLET_LEDGER_PERSISTENCE_PORT, useClass: PrismaWalletLedgerPersistenceAdapter },
    { provide: ENGAGEMENT_REFERRAL_ATTRIBUTION_PORT, useClass: EngagementReferralAttributionAdapter },
    {
      provide: ENGAGEMENT_REFERRAL_ATTRIBUTION_PERSISTENCE_PORT,
      useClass: ModuleEngagementReferralAttributionPersistenceAdapter,
    },
    { provide: ENGAGEMENT_REFERRAL_REWARD_PORT, useClass: ModuleEngagementReferralRewardAdapter },
    { provide: ENGAGEMENT_REFERRAL_NOTIFICATION_PORT, useClass: ModuleEngagementReferralNotificationAdapter },
    {
      provide: BookingWalletLedgerUseCase,
      useFactory: (persistencePort: CommerceWalletLedgerPersistencePort) =>
        new BookingWalletLedgerUseCase(persistencePort),
      inject: [COMMERCE_WALLET_LEDGER_PERSISTENCE_PORT],
    },
    { provide: COMMERCE_WALLET_LEDGER_PORT, useClass: PrismaCommerceWalletLedgerAdapter },
    {
      provide: ResolveLoyaltyRewardDecisionUseCase,
      useFactory: (
        loyaltyPolicyReadPort: CommerceLoyaltyPolicyReadPort,
        subscriptionPolicyPort: CommerceSubscriptionPolicyPort,
      ) => new ResolveLoyaltyRewardDecisionUseCase(loyaltyPolicyReadPort, subscriptionPolicyPort),
      inject: [COMMERCE_LOYALTY_POLICY_READ_PORT, COMMERCE_SUBSCRIPTION_POLICY_PORT],
    },
    {
      provide: ResolveReferralAttributionForBookingUseCase,
      useFactory: (persistencePort: EngagementReferralAttributionPersistencePort) =>
        new ResolveReferralAttributionForBookingUseCase(persistencePort),
      inject: [ENGAGEMENT_REFERRAL_ATTRIBUTION_PERSISTENCE_PORT],
    },
    {
      provide: AttachReferralAttributionToAppointmentUseCase,
      useFactory: (persistencePort: EngagementReferralAttributionPersistencePort) =>
        new AttachReferralAttributionToAppointmentUseCase(persistencePort),
      inject: [ENGAGEMENT_REFERRAL_ATTRIBUTION_PERSISTENCE_PORT],
    },
    {
      provide: HandleReferralAppointmentCancelledUseCase,
      useFactory: (persistencePort: EngagementReferralAttributionPersistencePort) =>
        new HandleReferralAppointmentCancelledUseCase(persistencePort),
      inject: [ENGAGEMENT_REFERRAL_ATTRIBUTION_PERSISTENCE_PORT],
    },
    {
      provide: HandleReferralAppointmentCompletedUseCase,
      useFactory: (
        persistencePort: EngagementReferralAttributionPersistencePort,
        rewardPort: EngagementReferralRewardPort,
        notificationPort: EngagementReferralNotificationPort,
      ) =>
        new HandleReferralAppointmentCompletedUseCase(
          persistencePort,
          rewardPort,
          notificationPort,
        ),
      inject: [
        ENGAGEMENT_REFERRAL_ATTRIBUTION_PERSISTENCE_PORT,
        ENGAGEMENT_REFERRAL_REWARD_PORT,
        ENGAGEMENT_REFERRAL_NOTIFICATION_PORT,
      ],
    },
    {
      provide: GetAvailabilityUseCase,
      useFactory: (
        availabilityReadPort: BookingAvailabilityReadPort,
        schedulePolicyReadPort: SchedulePolicyReadPort,
        holidayReadPort: HolidayReadPort,
        barberEligibilityReadPort: BarberEligibilityReadPort,
        serviceCatalogReadPort: ServiceCatalogReadPort,
      ) =>
        new GetAvailabilityUseCase(
          availabilityReadPort,
          schedulePolicyReadPort,
          holidayReadPort,
          barberEligibilityReadPort,
          serviceCatalogReadPort,
        ),
      inject: [
        BOOKING_AVAILABILITY_READ_PORT,
        SCHEDULE_POLICY_READ_PORT,
        HOLIDAY_READ_PORT,
        BARBER_ELIGIBILITY_READ_PORT,
        SERVICE_CATALOG_READ_PORT,
      ],
    },
    {
      provide: GetBookingDashboardSummaryUseCase,
      useFactory: (
        bookingDashboardReadPort: BookingDashboardReadPort,
        clockPort: ClockPort,
      ) => new GetBookingDashboardSummaryUseCase(bookingDashboardReadPort, clockPort),
      inject: [BOOKING_DASHBOARD_READ_PORT, CLOCK_PORT],
    },
    {
      provide: GetAvailabilityBatchUseCase,
      useFactory: (
        availabilityReadPort: BookingAvailabilityReadPort,
        schedulePolicyReadPort: SchedulePolicyReadPort,
        holidayReadPort: HolidayReadPort,
        barberEligibilityReadPort: BarberEligibilityReadPort,
        serviceCatalogReadPort: ServiceCatalogReadPort,
      ) =>
        new GetAvailabilityBatchUseCase(
          availabilityReadPort,
          schedulePolicyReadPort,
          holidayReadPort,
          barberEligibilityReadPort,
          serviceCatalogReadPort,
        ),
      inject: [
        BOOKING_AVAILABILITY_READ_PORT,
        SCHEDULE_POLICY_READ_PORT,
        HOLIDAY_READ_PORT,
        BARBER_ELIGIBILITY_READ_PORT,
        SERVICE_CATALOG_READ_PORT,
      ],
    },
    {
      provide: FindAppointmentsPageUseCase,
      useFactory: (bookingAppointmentQueryPort: BookingAppointmentQueryPort) =>
        new FindAppointmentsPageUseCase(bookingAppointmentQueryPort),
      inject: [BOOKING_APPOINTMENT_QUERY_PORT],
    },
    {
      provide: FindAppointmentsPageWithClientsUseCase,
      useFactory: (bookingAppointmentQueryPort: BookingAppointmentQueryPort) =>
        new FindAppointmentsPageWithClientsUseCase(bookingAppointmentQueryPort),
      inject: [BOOKING_APPOINTMENT_QUERY_PORT],
    },
    {
      provide: FindAppointmentsRangeWithClientsUseCase,
      useFactory: (bookingAppointmentQueryPort: BookingAppointmentQueryPort) =>
        new FindAppointmentsRangeWithClientsUseCase(bookingAppointmentQueryPort),
      inject: [BOOKING_APPOINTMENT_QUERY_PORT],
    },
    {
      provide: FindAppointmentByIdUseCase,
      useFactory: (
        bookingAppointmentQueryPort: BookingAppointmentQueryPort,
        bookingMaintenancePort: BookingMaintenancePort,
      ) => new FindAppointmentByIdUseCase(bookingAppointmentQueryPort, bookingMaintenancePort),
      inject: [BOOKING_APPOINTMENT_QUERY_PORT, BOOKING_MAINTENANCE_PORT],
    },
    {
      provide: GetWeeklyLoadUseCase,
      useFactory: (availabilityReadPort: BookingAvailabilityReadPort) => new GetWeeklyLoadUseCase(availabilityReadPort),
      inject: [BOOKING_AVAILABILITY_READ_PORT],
    },
    {
      provide: CreateAppointmentUseCase,
      useFactory: (bookingCommandPort: BookingCommandPort, bookingUnitOfWorkPort: BookingUnitOfWorkPort) =>
        new CreateAppointmentUseCase(bookingCommandPort, bookingUnitOfWorkPort),
      inject: [BOOKING_COMMAND_PORT, BOOKING_UNIT_OF_WORK_PORT],
    },
    {
      provide: UpdateAppointmentUseCase,
      useFactory: (bookingCommandPort: BookingCommandPort, bookingUnitOfWorkPort: BookingUnitOfWorkPort) =>
        new UpdateAppointmentUseCase(bookingCommandPort, bookingUnitOfWorkPort),
      inject: [BOOKING_COMMAND_PORT, BOOKING_UNIT_OF_WORK_PORT],
    },
    {
      provide: RemoveAppointmentUseCase,
      useFactory: (bookingCommandPort: BookingCommandPort, bookingUnitOfWorkPort: BookingUnitOfWorkPort) =>
        new RemoveAppointmentUseCase(bookingCommandPort, bookingUnitOfWorkPort),
      inject: [BOOKING_COMMAND_PORT, BOOKING_UNIT_OF_WORK_PORT],
    },
    {
      provide: RunAppointmentStatusSideEffectsUseCase,
      useFactory: (
        sideEffectsPort: BookingStatusSideEffectsPort,
        idempotencyPort: BookingIdempotencyPort,
      ) =>
        new RunAppointmentStatusSideEffectsUseCase(sideEffectsPort, idempotencyPort),
      inject: [BOOKING_STATUS_SIDE_EFFECTS_PORT, BOOKING_IDEMPOTENCY_PORT],
    },
    {
      provide: SyncAppointmentStatusesUseCase,
      useFactory: (bookingMaintenancePort: BookingMaintenancePort) =>
        new SyncAppointmentStatusesUseCase(bookingMaintenancePort),
      inject: [BOOKING_MAINTENANCE_PORT],
    },
    {
      provide: AnonymizeAppointmentUseCase,
      useFactory: (bookingMaintenancePort: BookingMaintenancePort) =>
        new AnonymizeAppointmentUseCase(bookingMaintenancePort),
      inject: [BOOKING_MAINTENANCE_PORT],
    },
    {
      provide: SendAppointmentPaymentConfirmationUseCase,
      useFactory: (bookingMaintenancePort: BookingMaintenancePort) =>
        new SendAppointmentPaymentConfirmationUseCase(bookingMaintenancePort),
      inject: [BOOKING_MAINTENANCE_PORT],
    },
  ],
  exports: [AppointmentsFacade],
})
export class AppointmentsModule {}
