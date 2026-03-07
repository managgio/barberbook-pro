import { IdentityUserAccessRecord, IdentityUserRole } from '../../domain/entities/user-access.entity';

export const IDENTITY_USER_READ_PORT = Symbol('IDENTITY_USER_READ_PORT');

export type FindUsersPageParams = {
  brandId: string;
  localId: string;
  page: number;
  pageSize: number;
  role?: IdentityUserRole;
  query?: string;
};

export interface UserReadPort {
  findUsersByIds(params: { brandId: string; localId: string; ids: string[] }): Promise<IdentityUserAccessRecord[]>;
  findUsersPage(params: FindUsersPageParams): Promise<{ total: number; users: IdentityUserAccessRecord[] }>;
  findUserById(params: { brandId: string; localId: string; userId: string }): Promise<IdentityUserAccessRecord | null>;
  findUserByEmail(params: { brandId: string; localId: string; email: string }): Promise<IdentityUserAccessRecord | null>;
  findUserByFirebaseUid(params: {
    brandId: string;
    localId: string;
    firebaseUid: string;
  }): Promise<IdentityUserAccessRecord | null>;
}

