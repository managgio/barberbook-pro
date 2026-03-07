import { RequestContext } from '../../../../shared/application/request-context';
import { IdentityUserRole } from '../../domain/entities/user-access.entity';

export type UpdateUserCommand = {
  context: RequestContext;
  userId: string;
  firebaseUid?: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: IdentityUserRole;
  avatar?: string;
  adminRoleId?: string | null;
  isSuperAdmin?: boolean;
  isPlatformAdmin?: boolean;
  notificationEmail?: boolean;
  notificationWhatsapp?: boolean;
  notificationSms?: boolean;
  prefersBarberSelection?: boolean;
};
