import {
  BookingSchedulePolicy,
  ExtraordinaryOpeningsByDate,
} from '../../domain/value-objects/schedule';

export const EXTRAORDINARY_OPENING_MANAGEMENT_PORT = Symbol(
  'EXTRAORDINARY_OPENING_MANAGEMENT_PORT',
);

export type ExtraordinaryOpeningConflictSummary = {
  generalHoliday: boolean;
  generalClosure: boolean;
  barberHolidayIds: string[];
  barberClosureIds: string[];
};

export interface ExtraordinaryOpeningManagementPort {
  updateOpenings(params: {
    localId: string;
    openings: ExtraordinaryOpeningsByDate;
  }): Promise<BookingSchedulePolicy>;

  findConflicts(params: {
    localId: string;
    dateOnly: string;
    timezone: string;
    allProfessionals: boolean;
    barberIds: string[];
  }): Promise<ExtraordinaryOpeningConflictSummary>;
}
