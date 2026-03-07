import { DomainError } from '../../../../shared/domain/domain-error';
import { UserWritePort } from '../../ports/outbound/user-write.port';
import { SetUserBrandBlockStatusCommand } from '../commands/set-user-brand-block-status.command';

export class SetUserBrandBlockStatusUseCase {
  constructor(private readonly userWritePort: UserWritePort) {}

  async execute(command: SetUserBrandBlockStatusCommand) {
    const updated = await this.userWritePort.setBrandBlockStatus({
      brandId: command.context.brandId,
      localId: command.context.localId,
      userId: command.userId,
      isBlocked: command.isBlocked,
    });

    if (!updated) {
      throw new DomainError('User not found', 'USER_NOT_FOUND');
    }

    return updated;
  }
}
