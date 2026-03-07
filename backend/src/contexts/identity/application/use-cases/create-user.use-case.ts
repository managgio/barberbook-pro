import { UserWritePort } from '../../ports/outbound/user-write.port';
import { CreateUserCommand } from '../commands/create-user.command';

export class CreateUserUseCase {
  constructor(private readonly userWritePort: UserWritePort) {}

  execute(command: CreateUserCommand) {
    return this.userWritePort.create({
      brandId: command.context.brandId,
      localId: command.context.localId,
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
  }
}
