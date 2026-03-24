import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { GetAvailabilityUseCase } from '../../contexts/booking/application/use-cases/get-availability.use-case';
import { GetAvailabilityBatchUseCase } from '../../contexts/booking/application/use-cases/get-availability-batch.use-case';
import { GetWeeklyLoadUseCase } from '../../contexts/booking/application/use-cases/get-weekly-load.use-case';
import { GetBookingDashboardSummaryUseCase } from '../../contexts/booking/application/use-cases/get-booking-dashboard-summary.use-case';
import { SendAppointmentPaymentConfirmationUseCase } from '../../contexts/booking/application/use-cases/send-appointment-payment-confirmation.use-case';
import { CreateAppointmentUseCase } from '../../contexts/booking/application/use-cases/create-appointment.use-case';
import { RemoveAppointmentUseCase } from '../../contexts/booking/application/use-cases/remove-appointment.use-case';
import { UpdateAppointmentUseCase } from '../../contexts/booking/application/use-cases/update-appointment.use-case';
import { FindAppointmentsPageUseCase } from '../../contexts/booking/application/use-cases/find-appointments-page.use-case';
import { FindAppointmentsPageWithClientsUseCase } from '../../contexts/booking/application/use-cases/find-appointments-page-with-clients.use-case';
import { FindAppointmentsRangeWithClientsUseCase } from '../../contexts/booking/application/use-cases/find-appointments-range-with-clients.use-case';
import { FindAppointmentByIdUseCase } from '../../contexts/booking/application/use-cases/find-appointment-by-id.use-case';
import { AnonymizeAppointmentUseCase } from '../../contexts/booking/application/use-cases/anonymize-appointment.use-case';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../contexts/platform/ports/outbound/tenant-context.port';
import { SettingsService } from '../settings/settings.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

@Injectable()
export class AppointmentsFacade {
  private readonly logger = new Logger(AppointmentsFacade.name);

  constructor(
    private readonly getAvailabilityUseCase: GetAvailabilityUseCase,
    private readonly getAvailabilityBatchUseCase: GetAvailabilityBatchUseCase,
    private readonly getWeeklyLoadUseCase: GetWeeklyLoadUseCase,
    private readonly getBookingDashboardSummaryUseCase: GetBookingDashboardSummaryUseCase,
    private readonly sendAppointmentPaymentConfirmationUseCase: SendAppointmentPaymentConfirmationUseCase,
    private readonly createAppointmentUseCase: CreateAppointmentUseCase,
    private readonly updateAppointmentUseCase: UpdateAppointmentUseCase,
    private readonly removeAppointmentUseCase: RemoveAppointmentUseCase,
    private readonly findAppointmentsPageUseCase: FindAppointmentsPageUseCase,
    private readonly findAppointmentsPageWithClientsUseCase: FindAppointmentsPageWithClientsUseCase,
    private readonly findAppointmentsRangeWithClientsUseCase: FindAppointmentsRangeWithClientsUseCase,
    private readonly findAppointmentByIdUseCase: FindAppointmentByIdUseCase,
    private readonly anonymizeAppointmentUseCase: AnonymizeAppointmentUseCase,
    private readonly settingsService: SettingsService,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
  ) {}

  private logUseCaseTiming(capability: string, durationMs: number, outcome: 'ok' | 'error') {
    this.logger.log(
      `capability=${capability} mode=v2 durationMs=${durationMs} outcome=${outcome}`,
    );
  }

  private resolveSlotIntervalMinutes(value: number | null | undefined) {
    return value === 30 ? 30 : 15;
  }

  async getAvailability(
    barberId: string,
    date: string,
    serviceId?: string,
    appointmentIdToIgnore?: string,
  ) {
    const startedAt = Date.now();
    try {
      const settings = await this.settingsService.getSettings();
      const slotIntervalMinutes = this.resolveSlotIntervalMinutes(
        settings.appointments?.slotIntervalMinutes,
      );
      const response = await this.getAvailabilityUseCase.execute({
        context: this.tenantContextPort.getRequestContext(),
        barberId,
        date,
        serviceId,
        appointmentIdToIgnore,
        slotIntervalMinutes,
      });
      this.logUseCaseTiming('booking.availability.read', Date.now() - startedAt, 'ok');
      return response;
    } catch (error) {
      this.logUseCaseTiming('booking.availability.read', Date.now() - startedAt, 'error');
      throw error;
    }
  }

  async getAvailabilityBatch(
    date?: string,
    barberIds?: string[],
    options?: { serviceId?: string; appointmentIdToIgnore?: string },
  ) {
    if (!date) {
      throw new BadRequestException('date es obligatorio.');
    }

    const startedAt = Date.now();
    try {
      const normalizedBarberIds = Array.from(new Set((barberIds || []).filter(Boolean)));
      const settings = await this.settingsService.getSettings();
      const slotIntervalMinutes = this.resolveSlotIntervalMinutes(
        settings.appointments?.slotIntervalMinutes,
      );
      const response = await this.getAvailabilityBatchUseCase.execute({
        context: this.tenantContextPort.getRequestContext(),
        date,
        barberIds: normalizedBarberIds,
        serviceId: options?.serviceId,
        appointmentIdToIgnore: options?.appointmentIdToIgnore,
        slotIntervalMinutes,
      });
      this.logUseCaseTiming('booking.availability.batch.read', Date.now() - startedAt, 'ok');
      return response;
    } catch (error) {
      this.logUseCaseTiming('booking.availability.batch.read', Date.now() - startedAt, 'error');
      throw error;
    }
  }

  async getWeeklyLoad(dateFrom?: string, dateTo?: string, barberIds?: string[]) {
    if (!dateFrom || !dateTo) {
      throw new BadRequestException('dateFrom y dateTo son obligatorios.');
    }

    const startedAt = Date.now();
    try {
      const normalizedBarberIds = Array.from(new Set((barberIds || []).filter(Boolean)));
      const response = await this.getWeeklyLoadUseCase.execute({
        context: this.tenantContextPort.getRequestContext(),
        dateFrom,
        dateTo,
        barberIds: normalizedBarberIds,
      });
      this.logUseCaseTiming('booking.weekly-load.read', Date.now() - startedAt, 'ok');
      return response;
    } catch (error) {
      this.logUseCaseTiming('booking.weekly-load.read', Date.now() - startedAt, 'error');
      throw error;
    }
  }

  getDashboardSummary(params?: { windowDays?: number; barberId?: string }) {
    return this.getBookingDashboardSummaryUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
      windowDays: params?.windowDays,
      barberId: params?.barberId,
    });
  }

  sendPaymentConfirmation(appointmentId: string) {
    return this.sendAppointmentPaymentConfirmationUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
      appointmentId,
    });
  }

  findPageWithClients(params: {
    barberId?: string;
    date?: string;
    dateFrom?: string;
    dateTo?: string;
    sort?: 'asc' | 'desc';
    page: number;
    pageSize: number;
  }) {
    return this.findAppointmentsPageWithClientsUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
      filters: {
        barberId: params.barberId,
        date: params.date,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        sort: params.sort,
      },
      page: params.page,
      pageSize: params.pageSize,
    });
  }

  findRangeWithClients(params: {
    barberId?: string;
    date?: string;
    dateFrom?: string;
    dateTo?: string;
    sort?: 'asc' | 'desc';
  }) {
    return this.findAppointmentsRangeWithClientsUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
      filters: {
        barberId: params.barberId,
        date: params.date,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        sort: params.sort,
      },
    });
  }

  findPage(params: {
    userId?: string;
    barberId?: string;
    date?: string;
    dateFrom?: string;
    dateTo?: string;
    sort?: 'asc' | 'desc';
    page: number;
    pageSize: number;
  }) {
    return this.findAppointmentsPageUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
      filters: {
        userId: params.userId,
        barberId: params.barberId,
        date: params.date,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        sort: params.sort,
      },
      page: params.page,
      pageSize: params.pageSize,
    });
  }

  findOne(id: string) {
    return this.findAppointmentByIdUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
      appointmentId: id,
    });
  }

  create(
    data: CreateAppointmentDto,
    context?: {
      requireConsent?: boolean;
      ip?: string | null;
      userAgent?: string | null;
      actorUserId?: string | null;
      skipNotifications?: boolean;
      payment?: {
        status?: any;
        method?: any;
        amount?: number;
        currency?: string;
        expiresAt?: Date | null;
        stripePaymentIntentId?: string | null;
        stripeCheckoutSessionId?: string | null;
      };
    },
  ): Promise<any> {
    const startedAt = Date.now();
    return this.createAppointmentUseCase.execute({
      context: this.tenantContextPort.getRequestContext({
        actorUserId: context?.actorUserId ?? null,
      }),
      input: {
        userId: data.userId,
        barberId: data.barberId,
        serviceId: data.serviceId,
        startDateTime: data.startDateTime,
        status: data.status,
        notes: data.notes,
        guestName: data.guestName,
        guestContact: data.guestContact,
        privacyConsentGiven: data.privacyConsentGiven,
        referralAttributionId: data.referralAttributionId,
        appliedCouponId: data.appliedCouponId,
        useWallet: data.useWallet,
        products: data.products,
      },
      execution: context
        ? {
            requireConsent: context.requireConsent,
            ip: context.ip,
            userAgent: context.userAgent,
            actorUserId: context.actorUserId,
            skipNotifications: context.skipNotifications,
            payment: context.payment
              ? {
                  status: context.payment.status,
                  method: context.payment.method,
                  amount: context.payment.amount,
                  currency: context.payment.currency,
                  expiresAt: context.payment.expiresAt,
                  stripePaymentIntentId: context.payment.stripePaymentIntentId,
                  stripeCheckoutSessionId: context.payment.stripeCheckoutSessionId,
                }
              : undefined,
          }
        : undefined,
    })
      .then((result) => {
        this.logUseCaseTiming('booking.appointment.create', Date.now() - startedAt, 'ok');
        return result;
      })
      .catch((error) => {
        this.logUseCaseTiming('booking.appointment.create', Date.now() - startedAt, 'error');
        throw error;
      });
  }

  anonymize(id: string, actorUserId?: string | null) {
    return this.anonymizeAppointmentUseCase.execute({
      context: this.tenantContextPort.getRequestContext({
        actorUserId: actorUserId ?? null,
      }),
      appointmentId: id,
      actorUserId: actorUserId ?? null,
      reason: 'manual',
    });
  }

  update(id: string, data: UpdateAppointmentDto, context?: { actorUserId?: string | null }) {
    const startedAt = Date.now();
    return this.updateAppointmentUseCase.execute({
      context: this.tenantContextPort.getRequestContext({
        actorUserId: context?.actorUserId ?? null,
      }),
      appointmentId: id,
      input: {
        userId: data.userId,
        barberId: data.barberId,
        serviceId: data.serviceId,
        startDateTime: data.startDateTime,
        status: data.status,
        notes: data.notes,
        guestName: data.guestName,
        guestContact: data.guestContact,
        price: data.price,
        paymentMethod: data.paymentMethod,
        referralAttributionId: data.referralAttributionId,
        appliedCouponId: data.appliedCouponId,
        walletAppliedAmount: data.walletAppliedAmount,
        products: data.products,
      },
      execution: {
        actorUserId: context?.actorUserId ?? null,
      },
    })
      .then((result) => {
        this.logUseCaseTiming('booking.appointment.update', Date.now() - startedAt, 'ok');
        return result;
      })
      .catch((error) => {
        this.logUseCaseTiming('booking.appointment.update', Date.now() - startedAt, 'error');
        throw error;
      });
  }

  remove(id: string) {
    const startedAt = Date.now();
    return this.removeAppointmentUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
      appointmentId: id,
    })
      .then((result) => {
        this.logUseCaseTiming('booking.appointment.remove', Date.now() - startedAt, 'ok');
        return result;
      })
      .catch((error) => {
        this.logUseCaseTiming('booking.appointment.remove', Date.now() - startedAt, 'error');
        throw error;
      });
  }
}
