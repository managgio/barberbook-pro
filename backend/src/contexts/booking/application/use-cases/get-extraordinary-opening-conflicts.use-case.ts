import { isISODateOnly } from '../../domain/value-objects/extraordinary-opening';
import { ExtraordinaryOpeningManagementPort } from '../../ports/outbound/extraordinary-opening-management.port';
import { GetExtraordinaryOpeningConflictsQuery } from '../queries/get-extraordinary-opening-conflicts.query';

export class GetExtraordinaryOpeningConflictsUseCase {
  constructor(private readonly managementPort: ExtraordinaryOpeningManagementPort) {}

  execute(query: GetExtraordinaryOpeningConflictsQuery) {
    if (!isISODateOnly(query.dateOnly)) {
      return Promise.resolve({
        generalHoliday: false,
        generalClosure: false,
        barberHolidayIds: [],
        barberClosureIds: [],
      });
    }

    return this.managementPort.findConflicts({
      localId: query.context.localId,
      dateOnly: query.dateOnly,
      timezone: query.context.timezone,
      allProfessionals: query.allProfessionals,
      barberIds: Array.from(new Set(query.barberIds.filter(Boolean))),
    });
  }
}
