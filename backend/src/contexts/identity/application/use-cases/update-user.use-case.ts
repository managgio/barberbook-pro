import { DomainError } from '../../../../shared/domain/domain-error';
import { UserWritePort } from '../../ports/outbound/user-write.port';
import { UpdateUserCommand } from '../commands/update-user.command';

export class UpdateUserUseCase {
  constructor(private readonly userWritePort: UserWritePort) {}

  async execute(command: UpdateUserCommand) {
    const updated = await this.userWritePort.update({
      brandId: command.context.brandId,
      localId: command.context.localId,
      userId: command.userId,
      input: {
        firebaseUid: command.firebaseUid,
        name: command.name,
        email: command.email,
        phone: command.phone,
        role: command.role,
        avatar: command.avatar,
        adminRoleId: command.adminRoleId,
        isSuperAdmin: command.isSuperAdmin,
        isPlatformAdmin: command.isPlatformAdmin,
        notificationEmail: command.notificationEmail,
        notificationWhatsapp: command.notificationWhatsapp,
        notificationSms: command.notificationSms,
        prefersBarberSelection: command.prefersBarberSelection,
      },
    });

    if (!updated) {
      throw new DomainError('User not found', 'USER_NOT_FOUND');
    }

    return updated;
  }
}
