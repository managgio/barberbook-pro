import { DomainError } from '../../../../shared/domain/domain-error';
import { BarberManagementPort } from '../../ports/outbound/barber-management.port';
import { UpdateBarberCommand } from '../commands/update-barber.command';

export class UpdateBarberUseCase {
  constructor(private readonly barberManagementPort: BarberManagementPort) {}

  async execute(command: UpdateBarberCommand) {
    const updated = await this.barberManagementPort.updateBarber({
      localId: command.context.localId,
      barberId: command.barberId,
      input: {
        name: command.name,
        photo: command.photo,
        photoFileId: command.photoFileId,
        specialty: command.specialty,
        role: command.role,
        bio: command.bio,
        startDate: command.startDate,
        endDate: command.endDate,
        isActive: command.isActive,
        calendarColor: command.calendarColor,
        userId: command.userId,
      },
    });

    if (!updated) {
      throw new DomainError('Barber not found', 'BARBER_NOT_FOUND');
    }

    return updated;
  }
}
