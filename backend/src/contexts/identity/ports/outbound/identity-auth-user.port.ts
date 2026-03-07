export const IDENTITY_AUTH_USER_PORT = Symbol('IDENTITY_AUTH_USER_PORT');

export interface IdentityAuthUserPort {
  deleteUser(firebaseUid: string): Promise<void>;
}
