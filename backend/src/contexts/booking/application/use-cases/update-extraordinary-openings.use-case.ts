import { normalizeExtraordinaryOpenings } from '../../domain/value-objects/extraordinary-opening';
import { ExtraordinaryOpeningManagementPort } from '../../ports/outbound/extraordinary-opening-management.port';
import { UpdateExtraordinaryOpeningsCommand } from '../commands/update-extraordinary-openings.command';

export class UpdateExtraordinaryOpeningsUseCase {
  constructor(private readonly managementPort: ExtraordinaryOpeningManagementPort) {}

  execute(command: UpdateExtraordinaryOpeningsCommand) {
    return this.managementPort.updateOpenings({
      localId: command.context.localId,
      openings: normalizeExtraordinaryOpenings(command.openings),
    });
  }
}
