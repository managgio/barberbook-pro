export type AdminRoleEntity = {
  id: string;
  localId: string;
  name: string;
  description: string | null;
  permissions: string[];
};

