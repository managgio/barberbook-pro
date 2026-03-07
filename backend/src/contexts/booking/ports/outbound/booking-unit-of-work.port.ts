import { UnitOfWorkPort } from '../../../../shared/application/unit-of-work.port';

export const BOOKING_UNIT_OF_WORK_PORT = Symbol('BOOKING_UNIT_OF_WORK_PORT');

export type BookingUnitOfWorkPort = UnitOfWorkPort;
