import { DomainError } from '../../../../shared/domain/domain-error';
import { CommerceServiceManagementPort } from '../../ports/outbound/service-management.port';
import { RemoveServiceCommand } from '../commands/remove-service.command';

export class RemoveServiceUseCase {
  constructor(private readonly serviceManagementPort: CommerceServiceManagementPort) {}

  async execute(command: RemoveServiceCommand): Promise<{ success: true }> {
    const result = await this.serviceManagementPort.archiveService({
      localId: command.context.localId,
      serviceId: command.serviceId,
    });

    if (result === 'not_found') {
      throw new DomainError('Service not found', 'SERVICE_NOT_FOUND');
    }

    return { success: true };
  }
}
