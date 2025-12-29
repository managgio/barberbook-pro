import { AdminRole } from '@prisma/client';

export const mapRole = (role: AdminRole) => ({
  id: role.id,
  name: role.name,
  description: role.description || null,
  permissions: Array.isArray(role.permissions) ? (role.permissions as string[]) : [],
});
