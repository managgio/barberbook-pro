import { User } from '@prisma/client';

export const mapUser = (
  user: User,
  options?: { adminRoleId?: string | null; isPlatformAdmin?: boolean; isLocalAdmin?: boolean },
) => ({
  id: user.id,
  firebaseUid: user.firebaseUid || undefined,
  name: user.name,
  email: user.email,
  phone: user.phone || undefined,
  role: user.role,
  notificationPrefs: {
    email: user.notificationEmail,
    whatsapp: user.notificationWhatsapp,
  },
  prefersBarberSelection: user.prefersBarberSelection,
  avatar: user.avatar || undefined,
  isSuperAdmin: user.isSuperAdmin,
  isPlatformAdmin: options?.isPlatformAdmin ?? user.isPlatformAdmin,
  isLocalAdmin: options?.isLocalAdmin ?? false,
  adminRoleId: options?.adminRoleId ?? user.adminRoleId ?? null,
});
