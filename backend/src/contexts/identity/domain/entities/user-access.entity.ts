export type IdentityUserRole = 'admin' | 'client';

export type IdentityUserAccessRecord = {
  id: string;
  firebaseUid: string | null;
  name: string;
  email: string;
  phone: string | null;
  role: IdentityUserRole;
  avatar: string | null;
  adminRoleId: string | null;
  isSuperAdmin: boolean;
  isPlatformAdmin: boolean;
  notificationEmail: boolean;
  notificationWhatsapp: boolean;
  notificationSms: boolean;
  prefersBarberSelection: boolean;
  isBlocked: boolean;
  isLocalAdmin: boolean;
  localAdminRoleId: string | null;
};

