import { RequestContext } from '../../../../shared/application/request-context';
import { BookingSchedulePolicy } from '../../domain/value-objects/schedule';

export type UpdateBarberScheduleCommand = {
  context: RequestContext;
  barberId: string;
  schedule: BookingSchedulePolicy;
};

