import { Injectable } from '@nestjs/common';
import {
  BookingGuestAppointmentReadPort,
  BookingGuestAppointmentRecord,
} from '../../../contexts/booking/ports/outbound/guest-appointment-read.port';
import { PrismaService } from '../../../prisma/prisma.service';
import { SettingsService } from '../../settings/settings.service';

@Injectable()
export class PrismaGuestAppointmentReadAdapter implements BookingGuestAppointmentReadPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  async findGuestAppointment(params: {
    localId: string;
    appointmentId: string;
  }): Promise<BookingGuestAppointmentRecord | null> {
    const appointment = await this.prisma.appointment.findFirst({
      where: {
        id: params.appointmentId,
        localId: params.localId,
        userId: null,
      },
      select: {
        id: true,
        status: true,
        startDateTime: true,
        totalDurationMinutes: true,
        serviceNameSnapshot: true,
        barberNameSnapshot: true,
        service: { select: { name: true, duration: true } },
        barber: { select: { name: true } },
        serviceItems: {
          orderBy: { position: 'asc' },
          select: { nameSnapshot: true, durationMinutes: true },
        },
      },
    });
    if (!appointment) return null;

    const itemNames = appointment.serviceItems.map((item) => item.nameSnapshot).filter(Boolean);
    const itemDuration = appointment.serviceItems.reduce(
      (total, item) => total + Math.max(0, item.durationMinutes),
      0,
    );
    return {
      id: appointment.id,
      status: appointment.status,
      startDateTime: appointment.startDateTime,
      durationMinutes: appointment.totalDurationMinutes || itemDuration || appointment.service.duration || 30,
      serviceName:
        appointment.serviceNameSnapshot?.trim()
        || itemNames.join(' + ')
        || appointment.service.name,
      professionalName:
        appointment.barberNameSnapshot?.trim()
        || appointment.barber.name
        || null,
    };
  }

  async getCancellationCutoffHours(): Promise<number> {
    const settings = await this.settingsService.getSettings();
    return Math.max(0, settings.appointments?.cancellationCutoffHours ?? 0);
  }
}
