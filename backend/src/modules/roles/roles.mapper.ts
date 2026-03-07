type RoleLike = {
  id: string;
  name: string;
  description: string | null;
  permissions: unknown;
};

export const mapRole = (role: RoleLike) => ({
  id: role.id,
  name: role.name,
  description: role.description || null,
  permissions: Array.isArray(role.permissions) ? (role.permissions as string[]) : [],
});
