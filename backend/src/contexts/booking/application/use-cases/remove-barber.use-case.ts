import { DomainError } from '../../../../shared/domain/domain-error';
import { BarberManagementPort } from '../../ports/outbound/barber-management.port';
import { BarberPhotoStoragePort } from '../../ports/outbound/barber-photo-storage.port';
import { RemoveBarberCommand } from '../commands/remove-barber.command';

export class RemoveBarberUseCase {
  constructor(
    private readonly barberManagementPort: BarberManagementPort,
    private readonly barberPhotoStoragePort: BarberPhotoStoragePort,
  ) {}

  async execute(command: RemoveBarberCommand): Promise<{ success: true; archived?: true }> {
    const removed = await this.barberManagementPort.removeBarber({
      localId: command.context.localId,
      barberId: command.barberId,
    });

    if (!removed) {
      throw new DomainError('Barber not found', 'BARBER_NOT_FOUND');
    }

    if (removed.photoFileId) {
      await this.barberPhotoStoragePort.deletePhotoFile({
        barberId: command.barberId,
        fileId: removed.photoFileId,
      });
    }

    if (removed.archived) {
      return { success: true, archived: true };
    }

    return { success: true };
  }
}
