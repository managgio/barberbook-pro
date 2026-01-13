import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { ADMIN_SECTIONS } from '@/data/adminSections';
import { AdminRole, AdminSectionKey, User } from '@/data/types';
import { 
  getAdminRoles,
  createAdminRole,
  updateAdminRole,
  deleteAdminRole,
  getUsers,
  updateUser,
} from '@/data/api';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Shield, Users } from 'lucide-react';
import EmptyState from '@/components/common/EmptyState';
import { cn } from '@/lib/utils';

const isSuperAdminUser = (candidate: User) => Boolean(candidate.isSuperAdmin);

const AdminRoles: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<AdminRole | null>(null);
  const [isDeletingRole, setIsDeletingRole] = useState<AdminRole | null>(null);
  const [isSavingRole, setIsSavingRole] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');

  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    permissions: AdminSectionKey[];
  }>({
    name: '',
    description: '',
    permissions: ['dashboard'],
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [rolesData, usersData] = await Promise.all([
        getAdminRoles(),
        getUsers(),
      ]);
      setRoles(rolesData);
      setUsers(usersData);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo cargar la información de roles.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreateDialog = () => {
    setEditingRole(null);
    setFormData({
      name: '',
      description: '',
      permissions: ['dashboard'],
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (role: AdminRole) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      description: role.description || '',
      permissions: role.permissions,
    });
    setIsDialogOpen(true);
  };

  const handleTogglePermission = (permission: AdminSectionKey) => {
    setFormData((prev) => {
      const exists = prev.permissions.includes(permission);
      return {
        ...prev,
        permissions: exists
          ? prev.permissions.filter((p) => p !== permission)
          : [...prev.permissions, permission],
      };
    });
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.permissions.length === 0) {
      toast({
        title: 'Selecciona permisos',
        description: 'Cada rol debe tener al menos una sección asignada.',
        variant: 'destructive',
      });
      return;
    }
    setIsSavingRole(true);
    try {
      if (editingRole) {
        await updateAdminRole(editingRole.id, formData);
        toast({ title: 'Rol actualizado', description: 'Los cambios se han guardado.' });
      } else {
        await createAdminRole(formData);
        toast({ title: 'Rol creado', description: 'El nuevo rol ya está disponible.' });
      }
      setIsDialogOpen(false);
      await loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo guardar el rol.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingRole(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!isDeletingRole) return;
    try {
      await deleteAdminRole(isDeletingRole.id);
      toast({ title: 'Rol eliminado', description: 'Los usuarios asignados han quedado sin rol.' });
      setIsDeletingRole(null);
      await loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el rol.',
        variant: 'destructive',
      });
    }
  };

  const handleToggleAdmin = async (targetUser: User, isAdmin: boolean) => {
    setUpdatingUserId(targetUser.id);
    try {
      await updateUser(targetUser.id, {
        role: isAdmin ? 'admin' : 'client',
        adminRoleId: isAdmin ? targetUser.adminRoleId || roles[0]?.id || null : null,
      });
      toast({
        title: isAdmin ? 'Usuario ascendido' : 'Usuario actualizado',
        description: isAdmin ? 'Ahora tiene acceso al panel admin.' : 'Se ha revocado el acceso admin.',
      });
      await loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar al usuario.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleAssignRole = async (userId: string, roleId: string) => {
    setUpdatingUserId(userId);
    try {
      await updateUser(userId, { adminRoleId: roleId });
      toast({ title: 'Rol asignado', description: 'El usuario ya tiene permisos actualizados.' });
      await loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo asignar el rol.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const adminUsers = useMemo(() => users.filter((u) => u.role === 'admin' && !isSuperAdminUser(u)), [users]);
  const searchResults = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    if (!query) return [];
    return users.filter((candidate) => 
      !isSuperAdminUser(candidate) &&
      `${candidate.name} ${candidate.email} ${candidate.phone || ''}`.toLowerCase().includes(query)
    );
  }, [userSearch, users]);
  const renderUserCard = (currentUser: User, highlight?: boolean) => {
    const isAdmin = currentUser.role === 'admin';
    const isSuperAdminUser = currentUser.isSuperAdmin;
    const isUpdating = updatingUserId === currentUser.id;

    return (
      <div
        key={currentUser.id}
        className={cn(
          'border rounded-2xl p-3 bg-card flex flex-col gap-3',
          highlight && 'border-primary/50 shadow-glow'
        )}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <p className="font-semibold text-foreground">{currentUser.name}</p>
            <p className="text-sm text-muted-foreground">{currentUser.email}</p>
          </div>
          <div className="flex items-center gap-3">
            {isSuperAdminUser && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                Superadmin
              </span>
            )}
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase text-muted-foreground">Acceso admin</span>
              <Switch
                checked={isAdmin}
                onCheckedChange={(checked) => handleToggleAdmin(currentUser, checked)}
                disabled={isSuperAdminUser || isUpdating}
              />
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Rol asignado</Label>
            <Select
              value={currentUser.adminRoleId || ''}
              onValueChange={(value) => handleAssignRole(currentUser.id, value)}
              disabled={!isAdmin || isSuperAdminUser || roles.length === 0 || isUpdating}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={roles.length === 0 ? 'Sin roles disponibles' : 'Selecciona un rol'} />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!currentUser.adminRoleId && isAdmin && !isSuperAdminUser && roles.length > 0 && (
              <p className="text-xs text-amber-500 mt-1">
                Asigna un rol para que pueda ver secciones del sidebar.
              </p>
            )}
          </div>
          <div className="self-end">
            <p className="text-xs text-muted-foreground">
              {isAdmin
                ? currentUser.adminRoleId
                  ? `Puede ver ${roles.find((r) => r.id === currentUser.adminRoleId)?.permissions.length || 0} secciones.`
                  : 'Sin permisos hasta asignar un rol.'
                : 'Usuario sin acceso al panel admin.'}
            </p>
          </div>
        </div>
      </div>
    );
  };

  if (!user?.isSuperAdmin) {
    return (
      <div className="max-w-3xl mx-auto mt-10">
        <Card>
          <CardHeader>
            <CardTitle>Acceso restringido</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Solo los superadministradores pueden gestionar roles y permisos.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-2 pl-12 md:pl-0">
        <h1 className="text-3xl font-bold text-foreground">Roles y permisos</h1>
        <p className="text-muted-foreground">
          Define qué secciones del panel puede ver cada administrador y asigna roles personalizados.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card variant="elevated">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Roles disponibles
              </CardTitle>
              <p className="text-sm text-muted-foreground">Configura las secciones visibles para cada rol.</p>
            </div>
            <Button onClick={openCreateDialog}>Nuevo rol</Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : roles.length === 0 ? (
              <EmptyState
                icon={Shield}
                title="Sin roles"
                description="Crea un rol para empezar a asignar permisos."
              />
            ) : (
              roles.map((role) => (
                <div key={role.id} className="border rounded-2xl p-4 bg-secondary/30 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-foreground">{role.name}</p>
                      <p className="text-sm text-muted-foreground">{role.description}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEditDialog(role)}>
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => setIsDeletingRole(role)}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {role.permissions.map((permission) => {
                      const section = ADMIN_SECTIONS.find((sec) => sec.key === permission);
                      return (
                        <span
                          key={`${role.id}-${permission}`}
                          className="px-3 py-1 rounded-full text-xs bg-primary/10 text-primary"
                        >
                          {section?.label || permission}
                        </span>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Asignado a {users.filter((u) => u.adminRoleId === role.id).length} administradores.
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Administradores
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Activa el acceso al panel y asigna un rol a cada usuario.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : users.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No hay usuarios"
                description="Crea usuarios antes de asignar roles."
              />
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="user-search">Buscar usuario</Label>
                  <Input
                    id="user-search"
                    placeholder="Nombre, email o teléfono..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Usa el buscador para dar acceso admin solo a quien lo necesite.
                  </p>
                </div>

                {userSearch.trim().length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs uppercase text-muted-foreground tracking-wide">Resultados</p>
                    {searchResults.length > 0 ? (
                      searchResults.map((result) => renderUserCard(result, true))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No encontramos usuarios que coincidan con la búsqueda.
                      </p>
                    )}
                  </div>
                )}

                <div className="border-t border-border pt-4 space-y-3">
                  <p className="text-xs uppercase text-muted-foreground tracking-wide">Administradores activos</p>
                  {adminUsers.length > 0 ? (
                    adminUsers.map((admin) => renderUserCard(admin))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Aún no hay administradores asignados. Activa alguno con el buscador.
                    </p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Role dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingRole ? 'Editar rol' : 'Nuevo rol'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveRole} className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role-name">Nombre del rol</Label>
                <Input
                  id="role-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role-description">Descripción</Label>
                <Textarea
                  id="role-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={1}
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Permisos del sidebar</Label>
              <div className="grid sm:grid-cols-2 gap-2">
                {ADMIN_SECTIONS.map((section) => (
                  <label
                    key={section.key}
                    className={cn(
                      'flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors',
                      formData.permissions.includes(section.key)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/40'
                    )}
                  >
                    <Checkbox
                      checked={formData.permissions.includes(section.key)}
                      onCheckedChange={() => handleTogglePermission(section.key)}
                    />
                    <div>
                      <p className="font-medium text-sm text-foreground">{section.label}</p>
                      <p className="text-xs text-muted-foreground">{section.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSavingRole}>
                {isSavingRole && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Guardar rol
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!isDeletingRole} onOpenChange={() => setIsDeletingRole(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar rol?</AlertDialogTitle>
            <AlertDialogDescription>
              Los administradores asignados a este rol quedarán sin permisos hasta que les asignes otro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDeleteRole}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminRoles;
