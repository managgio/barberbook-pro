import { Injectable } from '@nestjs/common';
import { AiBookingToolPort } from '../../../contexts/ai-orchestration/ports/outbound/ai-booking-tool.port';
import { AppointmentsFacade } from '../../appointments/appointments.facade';

@Injectable()
export class ModuleAiBookingToolAdapter implements AiBookingToolPort {
  constructor(private readonly appointmentsFacade: AppointmentsFacade) {}

  async createAppointment(params: {
    barberId: string;
    serviceId: string;
    startDateTime: string;
    status?: string;
    userId?: string;
    guestName?: string;
    guestContact?: string;
    notes?: string;
  }): Promise<{ id: string; startDateTime: string }> {
    const created = await this.appointmentsFacade.create(
      {
        barberId: params.barberId,
        serviceId: params.serviceId,
        startDateTime: params.startDateTime,
        status: params.status as any,
        userId: params.userId,
        guestName: params.guestName,
        guestContact: params.guestContact,
        notes: params.notes,
      } as any,
      { requireConsent: false },
    );
    return {
      id: created.id,
      startDateTime:
        typeof created.startDateTime === 'string'
          ? created.startDateTime
          : new Date(created.startDateTime).toISOString(),
    };
  }

  async getWeeklyLoad(dateFrom?: string, dateTo?: string, barberIds?: string[]) {
    return this.appointmentsFacade.getWeeklyLoad(dateFrom, dateTo, barberIds);
  }

  async getAvailableSlotsBatch(
    date?: string,
    barberIds?: string[],
    options?: { serviceId?: string; appointmentIdToIgnore?: string },
  ) {
    return this.appointmentsFacade.getAvailabilityBatch(date, barberIds, options);
  }
}
