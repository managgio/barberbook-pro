import { User } from '@prisma/client';

export const mapUser = (user: User) => ({
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
  avatar: user.avatar || undefined,
  isSuperAdmin: user.isSuperAdmin,
  adminRoleId: user.adminRoleId || null,
});
