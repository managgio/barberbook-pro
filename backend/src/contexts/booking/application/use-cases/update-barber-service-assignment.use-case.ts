import { DomainError } from '../../../../shared/domain/domain-error';
import { BarberManagementPort } from '../../ports/outbound/barber-management.port';
import { UpdateBarberServiceAssignmentCommand } from '../commands/update-barber-service-assignment.command';

export class UpdateBarberServiceAssignmentUseCase {
  constructor(private readonly barberManagementPort: BarberManagementPort) {}

  async execute(command: UpdateBarberServiceAssignmentCommand) {
    const updated = await this.barberManagementPort.updateBarberServiceAssignment({
      localId: command.context.localId,
      barberId: command.barberId,
      input: {
        serviceIds: command.serviceIds,
        categoryIds: command.categoryIds,
      },
    });

    if (!updated) {
      throw new DomainError('Barber not found', 'BARBER_NOT_FOUND');
    }

    return updated;
  }
}
