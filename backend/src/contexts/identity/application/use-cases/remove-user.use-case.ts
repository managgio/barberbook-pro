import { DomainError } from '../../../../shared/domain/domain-error';
import { IdentityAuthUserPort } from '../../ports/outbound/identity-auth-user.port';
import { UserWritePort } from '../../ports/outbound/user-write.port';
import { RemoveUserCommand } from '../commands/remove-user.command';

export class RemoveUserUseCase {
  constructor(
    private readonly userWritePort: UserWritePort,
    private readonly identityAuthUserPort: IdentityAuthUserPort,
  ) {}

  async execute(command: RemoveUserCommand): Promise<{ success: true; removedGlobally: boolean }> {
    const removed = await this.userWritePort.remove({
      brandId: command.context.brandId,
      localId: command.context.localId,
      userId: command.userId,
    });

    if (!removed) {
      throw new DomainError('User not found', 'USER_NOT_FOUND');
    }

    if (removed.removedGlobally && removed.firebaseUid) {
      try {
        await this.identityAuthUserPort.deleteUser(removed.firebaseUid);
      } catch {
        // Firebase cleanup is best-effort and must not rollback local deletion.
      }
    }

    return {
      success: true,
      removedGlobally: removed.removedGlobally,
    };
  }
}
