import { BookingAvailabilityReadPort } from '../../ports/outbound/booking-availability-read.port';
import { GetWeeklyLoadQuery } from '../queries/get-weekly-load.query';

export class GetWeeklyLoadUseCase {
  constructor(private readonly availabilityReadPort: BookingAvailabilityReadPort) {}

  async execute(query: GetWeeklyLoadQuery): Promise<{ counts: Record<string, number> }> {
    const counts = await this.availabilityReadPort.countWeeklyLoad({
      localId: query.context.localId,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      barberIds: query.barberIds,
    });

    if (query.barberIds && query.barberIds.length > 0) {
      query.barberIds.forEach((barberId) => {
        if (counts[barberId] === undefined) {
          counts[barberId] = 0;
        }
      });
    }

    return { counts };
  }
}
