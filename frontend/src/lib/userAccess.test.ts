import { describe, expect, it } from 'vitest';
import { hasTenantAdminAccess } from './userAccess';

describe('hasTenantAdminAccess', () => {
  it('does not trust an admin role or a legacy global super-admin flag', () => {
    expect(hasTenantAdminAccess({
      role: 'admin',
      isSuperAdmin: true,
      isLocalAdmin: false,
      isPlatformAdmin: false,
    })).toBe(false);
  });

  it('allows staff of the current local and platform administrators', () => {
    expect(hasTenantAdminAccess({ isLocalAdmin: true, isPlatformAdmin: false })).toBe(true);
    expect(hasTenantAdminAccess({ isLocalAdmin: false, isPlatformAdmin: true })).toBe(true);
  });
});
