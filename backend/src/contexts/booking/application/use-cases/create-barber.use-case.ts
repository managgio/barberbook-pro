import { BarberManagementPort } from '../../ports/outbound/barber-management.port';
import { CreateBarberCommand } from '../commands/create-barber.command';

export class CreateBarberUseCase {
  constructor(private readonly barberManagementPort: BarberManagementPort) {}

  execute(command: CreateBarberCommand) {
    return this.barberManagementPort.createBarber({
      localId: command.context.localId,
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
  }
}
