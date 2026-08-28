import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/hooks/useI18n';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useToast } from '@/hooks/use-toast';
import { hasTenantAdminAccess } from '@/lib/userAccess';

const RequiredPhoneModal: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const { settings, isLoading: isLoadingSettings } = useSiteSettings();
  const { t } = useI18n();
  const { toast } = useToast();
  const [phone, setPhone] = useState(user?.phone || '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setPhone(user?.phone || '');
  }, [user?.id, user?.phone]);

  const hasAdminAccess = hasTenantAdminAccess(user);
  const open = Boolean(
    !isLoadingSettings &&
      user &&
      !hasAdminAccess &&
      settings.profile?.phoneRequired === true &&
      !(user.phone || '').trim(),
  );

  const handleSave = async () => {
    const normalizedPhone = phone.trim();
    if (!normalizedPhone) {
      toast({
        title: t('profile.phoneRequired.missingTitle'),
        description: t('profile.phoneRequired.missingDescription'),
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      await updateProfile({ phone: normalizedPhone });
      toast({
        title: t('profile.phoneRequired.savedTitle'),
        description: t('profile.phoneRequired.savedDescription'),
      });
    } catch {
      toast({
        title: t('profile.phoneRequired.saveErrorTitle'),
        description: t('profile.phoneRequired.saveErrorDescription'),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AlertDialog open={open}>
      <AlertDialogContent
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{t('profile.phoneRequired.modalTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('profile.phoneRequired.modalDescription')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="required-phone-input">{t('profile.field.phone')}</Label>
          <Input
            id="required-phone-input"
            type="tel"
            autoComplete="tel"
            autoFocus
            placeholder={t('profile.field.phonePlaceholder')}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !isSaving) void handleSave();
            }}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogAction type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('profile.phoneRequired.saveAction')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default RequiredPhoneModal;
