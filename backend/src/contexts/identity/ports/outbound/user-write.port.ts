import { IdentityUserAccessRecord, IdentityUserRole } from '../../domain/entities/user-access.entity';

export const IDENTITY_USER_WRITE_PORT = Symbol('IDENTITY_USER_WRITE_PORT');

export type UserNotificationPrefsInput = {
  notificationEmail?: boolean;
  notificationWhatsapp?: boolean;
  notificationSms?: boolean;
  prefersBarberSelection?: boolean;
};

export type CreateIdentityUserInput = UserNotificationPrefsInput & {
  firebaseUid?: string;
  name: string;
  email: string;
  phone?: string;
  role?: IdentityUserRole;
  avatar?: string;
  adminRoleId?: string | null;
  isSuperAdmin?: boolean;
  isPlatformAdmin?: boolean;
};

export type UpdateIdentityUserInput = UserNotificationPrefsInput & {
  firebaseUid?: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: IdentityUserRole;
  avatar?: string;
  adminRoleId?: string | null;
  isSuperAdmin?: boolean;
  isPlatformAdmin?: boolean;
};

export type RemoveIdentityUserResult = {
  removedGlobally: boolean;
  firebaseUid: string | null;
};

export interface UserWritePort {
  create(params: {
    brandId: string;
    localId: string;
    input: CreateIdentityUserInput;
  }): Promise<IdentityUserAccessRecord>;
  update(params: {
    brandId: string;
    localId: string;
    userId: string;
    input: UpdateIdentityUserInput;
  }): Promise<IdentityUserAccessRecord | null>;
  setBrandBlockStatus(params: {
    brandId: string;
    localId: string;
    userId: string;
    isBlocked: boolean;
  }): Promise<IdentityUserAccessRecord | null>;
  remove(params: {
    brandId: string;
    localId: string;
    userId: string;
  }): Promise<RemoveIdentityUserResult | null>;
}
