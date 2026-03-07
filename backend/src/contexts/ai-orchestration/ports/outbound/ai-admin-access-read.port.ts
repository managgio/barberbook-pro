export const AI_ADMIN_ACCESS_READ_PORT = Symbol('AI_ADMIN_ACCESS_READ_PORT');

export interface AiAdminAccessReadPort {
  findUserById(params: {
    userId: string;
  }): Promise<{ id: string; isSuperAdmin: boolean; isPlatformAdmin: boolean } | null>;
  hasLocationStaffMembership(params: {
    localId: string;
    userId: string;
  }): Promise<boolean>;
}
