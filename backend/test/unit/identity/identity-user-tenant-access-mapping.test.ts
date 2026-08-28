import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { PrismaUserReadAdapter } from '@/contexts/identity/infrastructure/prisma/prisma-user-read.adapter';
import { PrismaUserWriteAdapter } from '@/contexts/identity/infrastructure/prisma/prisma-user-write.adapter';

const baseUser = {
  id: 'user-1',
  firebaseUid: 'firebase-1',
  name: 'Owner A',
  email: 'owner-a@example.com',
  phone: null,
  role: 'admin',
  avatar: null,
  adminRoleId: null,
  isSuperAdmin: true,
  isPlatformAdmin: false,
  notificationEmail: true,
  notificationWhatsapp: false,
  notificationSms: true,
  prefersBarberSelection: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  brandMemberships: [{ isBlocked: false }],
};

test('tenant profile maps a global admin as client without current local staff membership', () => {
  const adapter = new PrismaUserReadAdapter({} as any, {} as any);
  const mapped = (adapter as any).toIdentityUserAccessRecord(
    { ...baseUser, localStaffRoles: [] },
    'owner-a@example.com',
  );

  assert.equal(mapped.role, 'client');
  assert.equal(mapped.isLocalAdmin, false);
  assert.equal(mapped.isSuperAdmin, false);
});

test('tenant profile maps current local staff and configured owner as tenant admin', () => {
  const adapter = new PrismaUserReadAdapter({} as any, {} as any);
  const mapped = (adapter as any).toIdentityUserAccessRecord(
    { ...baseUser, localStaffRoles: [{ adminRoleId: null }] },
    'owner-a@example.com',
  );

  assert.equal(mapped.role, 'admin');
  assert.equal(mapped.isLocalAdmin, true);
  assert.equal(mapped.isSuperAdmin, true);
});

test('user page role filter is derived from current local membership', async () => {
  let capturedWhere: any = null;
  const prisma = {
    $transaction: async (operations: any[]) => operations,
    user: {
      count: ({ where }: any) => {
        capturedWhere = where;
        return 0;
      },
      findMany: () => [],
    },
  };
  const adapter = new PrismaUserReadAdapter(
    prisma as any,
    { getBrandSuperAdminEmail: async () => undefined } as any,
  );

  await adapter.findUsersPage({
    brandId: 'brand-b',
    localId: 'local-b',
    role: 'client',
    page: 1,
    pageSize: 20,
  });

  assert.deepEqual(capturedWhere.localStaffRoles, { none: { localId: 'local-b' } });
  assert.equal(capturedWhere.role, undefined);
});

test('legacy global super-admin flag cannot create staff membership in another local', async () => {
  let deletes = 0;
  let upserts = 0;
  const adapter = new PrismaUserWriteAdapter({
    locationStaff: {
      deleteMany: async () => {
        deletes += 1;
      },
      upsert: async () => {
        upserts += 1;
      },
    },
  } as any, {} as any);

  await (adapter as any).syncLocalStaffRole('foreign-local', {
    id: 'owner-a',
    role: 'client',
    isSuperAdmin: true,
    isPlatformAdmin: false,
    adminRoleId: null,
  });

  assert.equal(deletes, 1);
  assert.equal(upserts, 0);
});
