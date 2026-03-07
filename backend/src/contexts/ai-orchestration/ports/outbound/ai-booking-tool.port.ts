export const AI_BOOKING_TOOL_PORT = Symbol('AI_BOOKING_TOOL_PORT');

export interface AiBookingToolPort {
  createAppointment(params: {
    barberId: string;
    serviceId: string;
    startDateTime: string;
    status?: string;
    userId?: string;
    guestName?: string;
    guestContact?: string;
    notes?: string;
  }): Promise<{
    id: string;
    startDateTime: string;
  }>;
  getWeeklyLoad(dateFrom?: string, dateTo?: string, barberIds?: string[]): Promise<{
    counts?: Record<string, number>;
  }>;
  getAvailableSlotsBatch(
    date?: string,
    barberIds?: string[],
    options?: { serviceId?: string; appointmentIdToIgnore?: string },
  ): Promise<Record<string, string[]>>;
}
