import { Injectable } from '@nestjs/common';
import { UnitOfWorkOptions } from '../../../../shared/application/unit-of-work.port';
import { BookingUnitOfWorkPort } from '../../ports/outbound/booking-unit-of-work.port';

@Injectable()
export class NoopBookingUnitOfWorkAdapter implements BookingUnitOfWorkPort {
  runInTransaction<T>(work: () => Promise<T>, _options?: UnitOfWorkOptions): Promise<T> {
    // Booking commands still run through legacy service transaction boundaries.
    return work();
  }
}
