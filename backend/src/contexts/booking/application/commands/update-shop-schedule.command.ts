import { RequestContext } from '../../../../shared/application/request-context';
import { BookingSchedulePolicy } from '../../domain/value-objects/schedule';

export type UpdateShopScheduleCommand = {
  context: RequestContext;
  schedule: BookingSchedulePolicy;
};

