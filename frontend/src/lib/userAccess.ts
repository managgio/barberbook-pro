import type { User } from '@/data/types';

type TenantAdminUser = Partial<
  Pick<User, 'role' | 'isSuperAdmin' | 'isLocalAdmin' | 'isPlatformAdmin'>
>;

/** Tenant administration is granted by local staff membership, never by a global role. */
export const hasTenantAdminAccess = (user?: TenantAdminUser | null): boolean =>
  Boolean(user?.isPlatformAdmin || user?.isLocalAdmin);
