import { makeDateInTimeZone } from '../../../../utils/timezone';

export const findFirstEarlierSlot = (params: {
  dateOnly: string;
  availableSlots: string[];
  now: Date;
  opportunityStart: Date;
  appointmentStart: Date;
  timezone: string;
}): Date | null => {
  for (const slot of params.availableSlots) {
    const [hour, minute] = slot.split(':').map(Number);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) continue;
    const candidate = makeDateInTimeZone(
      params.dateOnly,
      { hour, minute },
      params.timezone,
    );
    if (
      candidate.getTime() === params.opportunityStart.getTime() &&
      candidate > params.now &&
      candidate < params.appointmentStart
    ) {
      return candidate;
    }
  }
  return null;
};
