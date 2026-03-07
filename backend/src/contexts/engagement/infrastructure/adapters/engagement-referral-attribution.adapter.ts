import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AttachReferralAttributionToAppointmentUseCase } from '../../application/use-cases/attach-referral-attribution-to-appointment.use-case';
import { HandleReferralAppointmentCancelledUseCase } from '../../application/use-cases/handle-referral-appointment-cancelled.use-case';
import { HandleReferralAppointmentCompletedUseCase } from '../../application/use-cases/handle-referral-appointment-completed.use-case';
import {
  ResolveReferralAttributionForBookingError,
  ResolveReferralAttributionForBookingUseCase,
} from '../../application/use-cases/resolve-referral-attribution-for-booking.use-case';
import { EngagementReferralAttributionPort } from '../../ports/outbound/referral-attribution.port';
import {
  TENANT_CONTEXT_PORT,
  TenantContextPort,
} from '../../../platform/ports/outbound/tenant-context.port';

@Injectable()
export class EngagementReferralAttributionAdapter implements EngagementReferralAttributionPort {
  constructor(
    private readonly resolveReferralAttributionForBookingUseCase: ResolveReferralAttributionForBookingUseCase,
    private readonly attachReferralAttributionToAppointmentUseCase: AttachReferralAttributionToAppointmentUseCase,
    private readonly handleReferralAppointmentCancelledUseCase: HandleReferralAppointmentCancelledUseCase,
    private readonly handleReferralAppointmentCompletedUseCase: HandleReferralAppointmentCompletedUseCase,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
  ) {}

  async resolveAttributionForBooking(params: {
    referralAttributionId?: string | null;
    userId?: string | null;
    guestContact?: string | null;
  }) {
    try {
      return await this.resolveReferralAttributionForBookingUseCase.execute({
        localId: this.tenantContextPort.getRequestContext().localId,
        ...params,
      });
    } catch (error) {
      if (error instanceof ResolveReferralAttributionForBookingError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  async attachAttributionToAppointment(params: {
    attributionId: string;
    appointmentId: string;
    userId?: string | null;
    guestContact?: string | null;
    tx?: unknown;
  }): Promise<void> {
    await this.attachReferralAttributionToAppointmentUseCase.execute({
      localId: this.tenantContextPort.getRequestContext().localId,
      ...params,
      tx: params.tx as Prisma.TransactionClient | undefined,
    });
  }

  handleAppointmentCancelled(appointmentId: string): Promise<void> {
    return this.handleReferralAppointmentCancelledUseCase.execute({
      localId: this.tenantContextPort.getRequestContext().localId,
      appointmentId,
    });
  }

  handleAppointmentCompleted(appointmentId: string): Promise<void> {
    return this.handleReferralAppointmentCompletedUseCase.execute({
      localId: this.tenantContextPort.getRequestContext().localId,
      appointmentId,
    });
  }
}
