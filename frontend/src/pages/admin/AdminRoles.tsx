import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { ADMIN_SECTION_KEYS, getAdminSections } from '@/data/adminSections';
import {
  AdminPermissionKey,
  AdminRole,
  AdminSectionKey,
  CommunicationPermissionKey,
  User,
} from '@/data/types';
import { 
  getUsersPage,
  updateUser,
} from '@/data/api/users';
import {
  createAdminRole,
  deleteAdminRole,
  getAdminRoles,
  updateAdminRole,
} from '@/data/api/roles';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Shield, Users } from 'lucide-react';
import EmptyState from '@/components/common/EmptyState';
import { cn } from '@/lib/utils';
import { useBusinessCopy } from '@/lib/businessCopy';
import { dispatchUsersUpdated } from '@/lib/adminEvents';
import { useQuery } from '@tanstack/react-query';
import { useTenant } from '@/context/TenantContext';
import { queryKeys } from '@/lib/queryKeys';
import { adminNavItems } from '@/components/layout/adminNavItems';
import { useAdminPermissions } from '@/context/AdminPermissionsContext';
import { useI18n } from '@/hooks/useI18n';

const isSuperAdminUser = (candidate: User) => Boolean(candidate.isSuperAdmin || candidate.isPlatformAdmin);
const USER_SEARCH_DEBOUNCE_MS = 250;
const EMPTY_ROLES: AdminRole[] = [];
const EMPTY_USERS: User[] = [];
const COMMUNICATION_PERMISSION_MATRIX: Array<{
  key: CommunicationPermissionKey;
  labelKey: string;
  descriptionKey: string;
}> = [
  {
    key: 'communications:view',
    labelKey: 'admin.roles.communications.permissions.view.label',
    descriptionKey: 'admin.roles.communications.permissions.view.description',
  },
  {
    key: 'communications:create_draft',
    labelKey: 'admin.roles.communications.permissions.createDraft.label',
    descriptionKey: 'admin.roles.communications.permissions.createDraft.description',
  },
  {
    key: 'communications:preview',
    labelKey: 'admin.roles.communications.permissions.preview.label',
    descriptionKey: 'admin.roles.communications.permissions.preview.description',
  },
  {
    key: 'communications:execute',
    labelKey: 'admin.roles.communications.permissions.execute.label',
    descriptionKey: 'admin.roles.communications.permissions.execute.description',
  },
  {
    key: 'communications:schedule',
    labelKey: 'admin.roles.communications.permissions.schedule.label',
    descriptionKey: 'admin.roles.communications.permissions.schedule.description',
  },
  {
    key: 'communications:cancel_scheduled',
    labelKey: 'admin.roles.communications.permissions.cancelScheduled.label',
    descriptionKey: 'admin.roles.communications.permissions.cancelScheduled.description',
  },
  {
    key: 'communications:duplicate',
    labelKey: 'admin.roles.communications.permissions.duplicate.label',
    descriptionKey: 'admin.roles.communications.permissions.duplicate.description',
  },
  {
    key: 'communications:view_history',
    labelKey: 'admin.roles.communications.permissions.viewHistory.label',
    descriptionKey: 'admin.roles.communications.permissions.viewHistory.description',
  },
];
const COMMUNICATION_PERMISSION_KEYS = new Set(COMMUNICATION_PERMISSION_MATRIX.map((entry) => entry.key));
const isAdminSectionKey = (permission: AdminPermissionKey): permission is AdminSectionKey =>
  ADMIN_SECTION_KEYS.includes(permission as AdminSectionKey);

const AdminRoles: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();
  const copy = useBusinessCopy();
  const { currentLocationId } = useTenant();
  const { canAccessSection } = useAdminPermissions();
  const adminSections = useMemo(() => getAdminSections(copy, t), [copy, t]);
  const visibleSidebarSectionKeys = useMemo(
    () => new Set(adminNavItems.filter((item) => canAccessSection(item.section)).map((item) => item.section)),
    [canAccessSection],
  );
  const rolePermissionSections = useMemo(
    () => adminSections.filter((section) => visibleSidebarSectionKeys.has(section.key)),
    [adminSections, visibleSidebarSectionKeys],
  );
  const rolePermissionSectionKeys = useMemo(
    () => new Set(rolePermissionSections.map((section) => section.key)),
    [rolePermissionSections],
  );
  const availablePermissionKeys = useMemo(
    () =>
      new Set<AdminPermissionKey>([
        ...(Array.from(rolePermissionSectionKeys) as AdminPermissionKey[]),
        ...(COMMUNICATION_PERMISSION_MATRIX.map((entry) => entry.key) as AdminPermissionKey[]),
      ]),
    [rolePermissionSectionKeys],
  );
  const sanitizePermissions = useCallback(
    (permissions: AdminPermissionKey[]) => {
      const unique = Array.from(new Set(permissions));
      const filtered = unique.filter((permission) => availablePermissionKeys.has(permission));
      const sectionPermissions = filtered.filter((permission): permission is AdminSectionKey =>
        isAdminSectionKey(permission),
      );
      const fallbackSection: AdminSectionKey[] = rolePermissionSectionKeys.has('dashboard')
        ? ['dashboard']
        : rolePermissionSections.slice(0, 1).map((section) => section.key);
      const ensuredSections = sectionPermissions.length > 0 ? sectionPermissions : fallbackSection;
      const hasCommunicationsSection = ensuredSections.includes('communications');
      const scopedExtraPermissions = filtered.filter((permission) =>
        COMMUNICATION_PERMISSION_KEYS.has(permission as CommunicationPermissionKey),
      );
      const communicationPermissions = hasCommunicationsSection
        ? ([
            'communications:view',
            'communications:view_history',
            ...scopedExtraPermissions,
          ] as AdminPermissionKey[])
        : [];
      return Array.from(new Set([...ensuredSections, ...communicationPermissions])) as AdminPermissionKey[];
    },
    [availablePermissionKeys, rolePermissionSectionKeys, rolePermissionSections],
  );

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<AdminRole | null>(null);
  const [isDeletingRole, setIsDeletingRole] = useState<AdminRole | null>(null);
  const [isSavingRole, setIsSavingRole] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [debouncedUserSearch, setDebouncedUserSearch] = useState('');

  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    permissions: AdminPermissionKey[];
  }>({
    name: '',
    description: '',
    permissions: ['dashboard'],
  });

  const loadAdminUsers = useCallback(async () => {
    const collected: User[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 20) {
      const response = await getUsersPage({
        page,
        pageSize: 100,
        role: 'admin',
      });
      collected.push(...response.items);
      hasMore = response.hasMore;
      page += 1;
    }

    return collected;
  }, []);

  useEffect(() => {
    const trimmed = userSearch.trim();
    const timer = window.setTimeout(() => {
      setDebouncedUserSearch(trimmed);
    }, USER_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [userSearch]);

  const rolesQuery = useQuery({
    queryKey: queryKeys.adminRoles(currentLocationId),
    queryFn: getAdminRoles,
  });
  const adminUsersQuery = useQuery({
    queryKey: queryKeys.adminRoleUsers(currentLocationId),
    queryFn: loadAdminUsers,
  });
  const searchUsersQuery = useQuery({
    queryKey: queryKeys.adminRoleSearch(currentLocationId, debouncedUserSearch),
    queryFn: () =>
      getUsersPage({
        page: 1,
        pageSize: 25,
        q: debouncedUserSearch,
      }),
    enabled: debouncedUserSearch.length > 0,
  });
  const roles = rolesQuery.data ?? EMPTY_ROLES;
  const adminUsers = adminUsersQuery.data ?? EMPTY_USERS;
  const searchResults = useMemo(
    () => (searchUsersQuery.data?.items ?? EMPTY_USERS).filter((candidate) => !isSuperAdminUser(candidate)),
    [searchUsersQuery.data?.items],
  );
  const isLoading = rolesQuery.isLoading || adminUsersQuery.isLoading;
  const isSearchingUsers = debouncedUserSearch.length > 0 && searchUsersQuery.isFetching;

  useEffect(() => {
    if (!rolesQuery.error && !adminUsersQuery.error) return;
    toast({
      title: t('admin.common.error'),
      description: t('admin.roles.toast.loadDataError'),
      variant: 'destructive',
    });
  }, [adminUsersQuery.error, rolesQuery.error, t, toast]);

  useEffect(() => {
    if (!searchUsersQuery.error) return;
    toast({
      title: t('admin.common.error'),
      description: t('admin.roles.toast.searchUsersError'),
      variant: 'destructive',
    });
  }, [searchUsersQuery.error, t, toast]);

  const openCreateDialog = () => {
    setEditingRole(null);
    setFormData({
      name: '',
      description: '',
      permissions: sanitizePermissions(['dashboard']),
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (role: AdminRole) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      description: role.description || '',
      permissions: sanitizePermissions(role.permissions),
    });
    setIsDialogOpen(true);
  };

  const handleTogglePermission = (permission: AdminPermissionKey) => {
    if (!availablePermissionKeys.has(permission)) return;
    setFormData((prev) => {
      const exists = prev.permissions.includes(permission);
      const nextPermissions = exists
        ? prev.permissions.filter((p) => p !== permission)
        : [...prev.permissions, permission];
      return {
        ...prev,
        permissions: sanitizePermissions(nextPermissions),
      };
    });
  };
  const hasCommunicationsSection = formData.permissions.includes('communications');

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    const sanitizedPermissions = sanitizePermissions(formData.permissions);
    if (sanitizedPermissions.length === 0) {
      toast({
        title: t('admin.roles.toast.selectPermissionsTitle'),
        description: t('admin.roles.toast.selectPermissionsDescription'),
        variant: 'destructive',
      });
      return;
    }
    setIsSavingRole(true);
    try {
      const payload = {
        ...formData,
        permissions: sanitizedPermissions,
      };
      if (editingRole) {
        await updateAdminRole(editingRole.id, payload);
        toast({ title: t('admin.roles.toast.roleUpdatedTitle'), description: t('admin.roles.toast.changesSavedDescription') });
      } else {
        await createAdminRole(payload);
        toast({ title: t('admin.roles.toast.roleCreatedTitle'), description: t('admin.roles.toast.roleCreatedDescription') });
      }
      setIsDialogOpen(false);
      await Promise.all([rolesQuery.refetch(), adminUsersQuery.refetch()]);
    } catch (error) {
      toast({
        title: t('admin.common.error'),
        description: t('admin.roles.toast.saveRoleError'),
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
      dispatchUsersUpdated({ source: 'admin-roles' });
      toast({ title: t('admin.roles.toast.roleDeletedTitle'), description: t('admin.roles.toast.roleDeletedDescription') });
      setIsDeletingRole(null);
      await Promise.all([rolesQuery.refetch(), adminUsersQuery.refetch()]);
    } catch (error) {
      toast({
        title: t('admin.common.error'),
        description: t('admin.roles.toast.deleteRoleError'),
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
      dispatchUsersUpdated({ source: 'admin-roles' });
      toast({
        title: isAdmin ? t('admin.roles.toast.userPromotedTitle') : t('admin.roles.toast.userUpdatedTitle'),
        description: isAdmin ? t('admin.roles.toast.userPromotedDescription') : t('admin.roles.toast.userRevokedDescription'),
      });
      await Promise.all([
        adminUsersQuery.refetch(),
        debouncedUserSearch.length > 0 ? searchUsersQuery.refetch() : Promise.resolve(),
      ]);
    } catch (error) {
      toast({
        title: t('admin.common.error'),
        description: t('admin.roles.toast.updateUserError'),
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
      dispatchUsersUpdated({ source: 'admin-roles' });
      toast({ title: t('admin.roles.toast.roleAssignedTitle'), description: t('admin.roles.toast.roleAssignedDescription') });
      await Promise.all([
        adminUsersQuery.refetch(),
        debouncedUserSearch.length > 0 ? searchUsersQuery.refetch() : Promise.resolve(),
      ]);
    } catch (error) {
      toast({
        title: t('admin.common.error'),
        description: t('admin.roles.toast.assignRoleError'),
        variant: 'destructive',
      });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const activeAdminUsers = useMemo(
    () => adminUsers.filter((candidate) => candidate.role === 'admin' && !isSuperAdminUser(candidate)),
    [adminUsers],
  );
  const renderUserCard = (currentUser: User, highlight?: boolean) => {
    const isAdmin = currentUser.role === 'admin';
    const isSuperAdminUser = currentUser.isSuperAdmin || currentUser.isPlatformAdmin;
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
                {t('admin.roles.user.superadmin')}
              </span>
            )}
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase text-muted-foreground">{t('admin.roles.user.adminAccess')}</span>
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
            <Label className="text-xs text-muted-foreground">{t('admin.roles.user.assignedRole')}</Label>
            <Select
              value={currentUser.adminRoleId || ''}
              onValueChange={(value) => handleAssignRole(currentUser.id, value)}
              disabled={!isAdmin || isSuperAdminUser || roles.length === 0 || isUpdating}
            >
              <SelectTrigger className="mt-1">
                <SelectValue
                  placeholder={roles.length === 0 ? t('admin.roles.user.noRolesAvailable') : t('admin.roles.user.selectRole')}
                />
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
                {t('admin.roles.user.assignRoleHint')}
              </p>
            )}
          </div>
          <div className="self-end">
            <p className="text-xs text-muted-foreground">
              {isAdmin
                ? currentUser.adminRoleId
                  ? t('admin.roles.user.canSeeSections', {
                      count: roles.find((r) => r.id === currentUser.adminRoleId)?.permissions.length || 0,
                    })
                  : t('admin.roles.user.noPermissionsYet')
                : t('admin.roles.user.noAdminAccess')}
            </p>
          </div>
        </div>
      </div>
    );
  };

  if (!user?.isSuperAdmin && !user?.isPlatformAdmin) {
    return (
      <div className="max-w-3xl mx-auto mt-10">
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.roles.restricted.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              {t('admin.roles.restricted.description')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-2 pl-12 md:pl-0">
        <h1 className="text-3xl font-bold text-foreground">{t('admin.roles.title')}</h1>
        <p className="text-muted-foreground">
          {t('admin.roles.subtitle')}
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card variant="elevated">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                {t('admin.roles.available.title')}
              </CardTitle>
              <p className="text-sm text-muted-foreground">{t('admin.roles.available.description')}</p>
            </div>
            <Button onClick={openCreateDialog}>{t('admin.roles.actions.newRole')}</Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : roles.length === 0 ? (
              <EmptyState
                icon={Shield}
                title={t('admin.roles.empty.title')}
                description={t('admin.roles.empty.description')}
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
                        {t('admin.common.edit')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => setIsDeletingRole(role)}
                      >
                        {t('admin.roles.actions.delete')}
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {role.permissions.map((permission) => {
                      const section = adminSections.find((sec) => sec.key === permission);
                      const communicationPermission = COMMUNICATION_PERMISSION_MATRIX.find(
                        (entry) => entry.key === permission,
                      );
                      return (
                        <span
                          key={`${role.id}-${permission}`}
                          className="px-3 py-1 rounded-full text-xs bg-primary/10 text-primary"
                        >
                          {section?.label || (communicationPermission ? t(communicationPermission.labelKey) : permission)}
                        </span>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('admin.roles.assignedCount', {
                      count: adminUsers.filter((u) => u.adminRoleId === role.id).length,
                    })}
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
              {t('admin.roles.admins.title')}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {t('admin.roles.admins.description')}
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="user-search">{t('admin.roles.search.label')}</Label>
                  <Input
                    id="user-search"
                    placeholder={t('admin.roles.search.placeholder')}
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('admin.roles.search.hint')}
                  </p>
                </div>

                {userSearch.trim().length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs uppercase text-muted-foreground tracking-wide">{t('admin.roles.search.results')}</p>
                    {isSearchingUsers ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t('admin.roles.search.loading')}
                      </div>
                    ) : searchResults.length > 0 ? (
                      searchResults.map((result) => renderUserCard(result, true))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {t('admin.roles.search.noResults')}
                      </p>
                    )}
                  </div>
                )}

                <div className="border-t border-border pt-4 space-y-3">
                  <p className="text-xs uppercase text-muted-foreground tracking-wide">{t('admin.roles.activeAdmins')}</p>
                  {activeAdminUsers.length > 0 ? (
                    activeAdminUsers.map((admin) => renderUserCard(admin))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t('admin.roles.activeAdminsEmpty')}
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
        <DialogContent className="max-w-2xl h-[85vh] max-h-[760px] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingRole ? t('admin.roles.dialog.editTitle') : t('admin.roles.dialog.newTitle')}</DialogTitle>
            <DialogDescription className="sr-only">
              {t('admin.roles.dialog.description')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveRole} className="flex flex-1 min-h-0 flex-col gap-5 overflow-hidden">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role-name">{t('admin.roles.dialog.roleName')}</Label>
                <Input
                  id="role-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role-description">{t('admin.roles.dialog.roleDescription')}</Label>
                <Textarea
                  id="role-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={1}
                />
              </div>
            </div>

            <div className="space-y-3 flex-1 min-h-0 overflow-y-auto pr-1">
              <Label>{t('admin.roles.dialog.sidebarPermissions')}</Label>
              <div className="grid sm:grid-cols-2 gap-2">
                {rolePermissionSections.map((section) => (
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
              {hasCommunicationsSection && (
                <div className="space-y-2 pt-2">
                  <Label>{t('admin.roles.communications.permissions.title')}</Label>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {COMMUNICATION_PERMISSION_MATRIX.map((permission) => (
                      <label
                        key={permission.key}
                        className={cn(
                          'flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors',
                          formData.permissions.includes(permission.key)
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/40',
                        )}
                      >
                        <Checkbox
                          checked={formData.permissions.includes(permission.key)}
                          onCheckedChange={() => handleTogglePermission(permission.key)}
                        />
                        <div>
                          <p className="font-medium text-sm text-foreground">{t(permission.labelKey)}</p>
                          <p className="text-xs text-muted-foreground">{t(permission.descriptionKey)}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                {t('appointmentEditor.cancel')}
              </Button>
              <Button type="submit" disabled={isSavingRole}>
                {isSavingRole && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t('admin.roles.dialog.saveRole')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!isDeletingRole} onOpenChange={() => setIsDeletingRole(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.roles.deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.roles.deleteDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('appointmentEditor.cancel')}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDeleteRole}>
              {t('admin.roles.actions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminRoles;
