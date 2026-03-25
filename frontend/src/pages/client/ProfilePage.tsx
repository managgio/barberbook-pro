import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTenant } from '@/context/TenantContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { User, Mail, Phone, Bell, Loader2, Award, Languages } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { getBarbers } from '@/data/api/barbers';
import { getLoyaltySummary } from '@/data/api/loyalty';
import { deleteUser } from '@/data/api/users';
import { LoyaltySummary } from '@/data/types';
import LoyaltyProgressPanel from '@/components/common/LoyaltyProgressPanel';
import { format, parseISO } from 'date-fns';
import { useBusinessCopy } from '@/lib/businessCopy';
import LanguageSelector from '@/components/common/LanguageSelector';
import { useLanguage } from '@/hooks/useLanguage';
import { useI18n } from '@/hooks/useI18n';
import { resolveDateLocale } from '@/lib/i18n';

const ProfilePage: React.FC = () => {
  const { user, updateProfile, logout } = useAuth();
  const { tenant, currentLocationId } = useTenant();
  const { toast } = useToast();
  const copy = useBusinessCopy();
  const { language, supportedLanguages } = useLanguage();
  const { t } = useI18n();
  const dateLocale = resolveDateLocale(language);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loyaltySummary, setLoyaltySummary] = useState<LoyaltySummary | null>(null);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
  });
  const [notificationPrefs, setNotificationPrefs] = useState({
    email: user?.notificationPrefs?.email ?? true,
    whatsapp: user?.notificationPrefs?.whatsapp ?? true,
    sms: user?.notificationPrefs?.sms ?? true,
  });
  const [prefersBarberSelection, setPrefersBarberSelection] = useState(
    user?.prefersBarberSelection ?? true,
  );
  const [activeBarberCount, setActiveBarberCount] = useState<number | null>(null);

  const notificationConfig = tenant?.config?.notificationPrefs;
  const allowEmail = notificationConfig?.email !== false;
  const allowWhatsapp = notificationConfig?.whatsapp !== false;
  const allowSms = notificationConfig?.sms !== false;

  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    const loadExtraData = async () => {
      const [loyaltyResult] = await Promise.allSettled([getLoyaltySummary(user.id)]);

      if (!isMounted) return;

      setLoyaltySummary(
        loyaltyResult.status === 'fulfilled' ? loyaltyResult.value : null,
      );
    };

    void loadExtraData();

    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user || !currentLocationId) return;
    let isMounted = true;

    const loadActiveBarbers = async () => {
      try {
        const barbers = await getBarbers();
        if (!isMounted) return;
        const count = barbers.filter((barber) => barber.isActive !== false).length;
        setActiveBarberCount(count);
      } catch {
        if (!isMounted) return;
        setActiveBarberCount(null);
      }
    };

    void loadActiveBarbers();

    return () => {
      isMounted = false;
    };
  }, [user, currentLocationId]);

  const showBarberSelectionPreference = activeBarberCount === null || activeBarberCount > 1;

  useEffect(() => {
    if (!user) return;
    setFormData({
      name: user.name || '',
      phone: user.phone || '',
    });
    setNotificationPrefs({
      email: user.notificationPrefs?.email ?? true,
      whatsapp: user.notificationPrefs?.whatsapp ?? true,
      sms: user.notificationPrefs?.sms ?? true,
    });
    setPrefersBarberSelection(user.prefersBarberSelection ?? true);
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 800));

      const normalizedPrefs = {
        email: allowEmail ? notificationPrefs.email : false,
        whatsapp: allowWhatsapp ? notificationPrefs.whatsapp : false,
        sms: allowSms ? notificationPrefs.sms : false,
      };

      await updateProfile({
        name: formData.name,
        phone: formData.phone,
        notificationPrefs: normalizedPrefs,
        prefersBarberSelection,
      });

      toast({
        title: t('profile.toast.updatedTitle'),
        description: t('profile.toast.updatedDescription'),
      });
    } catch (error) {
      toast({
        title: t('profile.toast.updateErrorTitle'),
        description: t('profile.toast.updateErrorDescription'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setIsDeleting(true);
    try {
      await deleteUser(user.id);
      await logout();
      toast({
        title: t('profile.toast.deletedTitle'),
        description: t('profile.toast.deletedDescription'),
      });
    } catch (error) {
      toast({
        title: t('profile.toast.deleteErrorTitle'),
        description: t('profile.toast.deleteErrorDescription'),
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl sm:text-3xl font-bold text-foreground">{t('profile.title')}</h1>
        <p className="text-xs sm:text-base text-muted-foreground mt-0.5 sm:mt-1">
          {t('profile.subtitle')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        {/* Personal Info */}
        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <User className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              {t('profile.section.personalInfo')}
            </CardTitle>
            <CardDescription className="hidden sm:block">
              {t('profile.section.personalInfoDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('profile.field.fullName')}</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                <Input
                  id="name"
                  type="text"
                  placeholder={t('profile.field.fullNamePlaceholder')}
                  className="h-9 sm:h-10 pl-9 sm:pl-10 text-sm"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t('profile.field.email')}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder={t('profile.field.emailPlaceholder')}
                  className="h-9 sm:h-10 pl-9 sm:pl-10 text-sm"
                  value={user?.email || ''}
                  disabled
                />
              </div>
              <p className="text-[11px] sm:text-xs text-muted-foreground">
                {t('profile.field.emailHint')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">{t('profile.field.phone')}</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder={t('profile.field.phonePlaceholder')}
                  className="h-9 sm:h-10 pl-9 sm:pl-10 text-sm"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {loyaltySummary?.enabled && (
          <Card id="loyalty" variant="elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Award className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                {t('profile.section.loyalty')}
              </CardTitle>
              <CardDescription className="hidden sm:block">
                {t('profile.section.loyaltyDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              {loyaltySummary.programs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('profile.loyalty.noPrograms')}
                </p>
              ) : (
                <div className="grid gap-3 sm:gap-4">
                  {loyaltySummary.programs.map(({ program, progress, rewards }) => (
                    <div key={program.id} className="rounded-xl border border-border/60 bg-muted/20 p-3 sm:p-4">
                      <LoyaltyProgressPanel program={program} progress={progress} variant="full" />
                      <div className="mt-3 sm:mt-4 border-t border-border/60 pt-2.5 sm:pt-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {t('profile.loyalty.history')}
                          </p>
                          {rewards.length > 0 && (
                            <span className="text-[11px] text-muted-foreground">
                              {t('profile.loyalty.rewardCount', {
                                count: rewards.length,
                                suffix: rewards.length === 1 ? '' : 's',
                              })}
                            </span>
                          )}
                        </div>
                        {rewards.length === 0 ? (
                          <p className="mt-2 text-[11px] sm:text-xs text-muted-foreground">
                            {t('profile.loyalty.noRewards')}
                          </p>
                        ) : (
                          <div className="mt-3 space-y-2">
                            {rewards.map((reward) => (
                              <div
                                key={reward.appointmentId}
                                className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/60 px-3 py-2"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-xs sm:text-sm font-medium text-foreground">
                                    {reward.serviceName ?? t('profile.loyalty.defaultService')}
                                  </p>
                                  <p className="text-[11px] sm:text-xs text-muted-foreground">
                                    {format(parseISO(reward.startDateTime), 'd MMM yyyy', { locale: dateLocale })}
                                  </p>
                                </div>
                                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                                  {t('profile.loyalty.free')}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {supportedLanguages.length > 1 && (
          <Card variant="elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Languages className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                {t('profile.section.language')}
              </CardTitle>
              <CardDescription className="hidden sm:block">
                {t('profile.section.languageDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <LanguageSelector persistForUser className="w-full sm:max-w-xs" />
              <p className="text-xs text-muted-foreground">
                {t('profile.language.current')} <span className="font-medium uppercase text-foreground">{language}</span>
              </p>
            </CardContent>
          </Card>
        )}

        {/* Notification Preferences */}
        {(allowEmail || allowWhatsapp || allowSms) && (
          <Card variant="elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                {t('profile.section.notifications')}
              </CardTitle>
              <CardDescription className="hidden sm:block">
                {t('profile.section.notificationsDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5 sm:space-y-4">
              {allowEmail && (
                <div className="flex items-center justify-between py-2">
                  <div className="space-y-0.5">
                    <Label htmlFor="email-notif">{t('profile.notifications.email')}</Label>
                    <p className="hidden sm:block text-sm text-muted-foreground">
                      {t('profile.notifications.emailDescription')}
                    </p>
                  </div>
                  <Switch
                    id="email-notif"
                    checked={notificationPrefs.email}
                    onCheckedChange={(checked) =>
                      setNotificationPrefs({ ...notificationPrefs, email: checked })
                    }
                  />
                </div>
              )}

              {allowEmail && (allowWhatsapp || allowSms) && <hr className="border-border" />}

              {allowWhatsapp && (
                <div className="flex items-center justify-between py-2">
                  <div className="space-y-0.5">
                    <Label htmlFor="whatsapp-notif">{t('profile.notifications.whatsapp')}</Label>
                    <p className="hidden sm:block text-sm text-muted-foreground">
                      {t('profile.notifications.whatsappDescription')}
                    </p>
                  </div>
                  <Switch
                    id="whatsapp-notif"
                    checked={notificationPrefs.whatsapp}
                    onCheckedChange={(checked) =>
                      setNotificationPrefs({ ...notificationPrefs, whatsapp: checked })
                    }
                  />
                </div>
              )}

              {allowWhatsapp && allowSms && <hr className="border-border" />}

              {allowSms && (
                <div className="flex items-center justify-between py-2">
                  <div className="space-y-0.5">
                    <Label htmlFor="sms-notif">{t('profile.notifications.sms')}</Label>
                    <p className="hidden sm:block text-sm text-muted-foreground">
                      {t('profile.notifications.smsDescription')}
                    </p>
                  </div>
                  <Switch
                    id="sms-notif"
                    checked={notificationPrefs.sms}
                    onCheckedChange={(checked) =>
                      setNotificationPrefs({ ...notificationPrefs, sms: checked })
                    }
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {showBarberSelectionPreference && (
          <Card variant="elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <User className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                {t('profile.bookingPreferences.title')}
              </CardTitle>
              <CardDescription className="hidden sm:block">
                {t('profile.bookingPreferences.description', { staffSingularLower: copy.staff.singularLower })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between py-2">
                <div className="space-y-0.5">
                  <Label htmlFor="barber-select-pref">
                    {t('profile.bookingPreferences.selectStaffLabel', { staffSingularLower: copy.staff.singularLower })}
                  </Label>
                  <p className="hidden sm:block text-sm text-muted-foreground">
                    {t('profile.bookingPreferences.selectStaffHelp', { staffIndefiniteSingular: copy.staff.indefiniteSingular })}
                  </p>
                </div>
                <Switch
                  id="barber-select-pref"
                  checked={prefersBarberSelection}
                  onCheckedChange={setPrefersBarberSelection}
                />
              </div>
              <p className="hidden sm:block text-xs text-muted-foreground">
                {t('profile.bookingPreferences.changeEachBooking')}
              </p>
            </CardContent>
          </Card>
        )}

        <Button type="submit" className="w-full h-9 sm:h-11 text-xs sm:text-base" size="lg" disabled={isLoading}>
          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {t('profile.actions.save')}
        </Button>

        {/* Danger zone */}
        <Card variant="elevated" className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive text-base sm:text-lg">{t('profile.danger.title')}</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {t('profile.danger.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              type="button"
              className="h-9 sm:h-10 text-xs sm:text-sm"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={isDeleting}
            >
              {t('profile.danger.deleteButton')}
            </Button>
          </CardContent>
        </Card>
      </form>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('profile.danger.dialogTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('profile.danger.dialogDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t('profile.danger.dialogCancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              type="button"
              onClick={handleDeleteAccount}
              disabled={isDeleting}
            >
              {isDeleting ? t('profile.danger.dialogDeleting') : t('profile.danger.dialogConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProfilePage;
