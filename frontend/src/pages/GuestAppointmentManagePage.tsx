import { useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  CalendarClock,
  CalendarDays,
  CalendarX2,
  CheckCircle2,
  Clock3,
  Layers3,
  Loader2,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from 'lucide-react';

import managgioLogo from '@/assets/img/managgio/logo.webp';
import '@/styles/guest-appointment.css';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  cancelGuestAppointment,
  getGuestAppointmentAccess,
} from '@/data/api/guestAppointmentAccess';
import { useTenant } from '@/context/TenantContext';
import { useI18n } from '@/hooks/useI18n';
import { resolveBrandLogo } from '@/lib/branding';
import { isApiRequestError } from '@/lib/networkErrors';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';

import {
  formatGuestAppointmentDateTime,
  getCancellationReasonTranslationKey,
  getGuestAppointmentStatusTone,
  getGuestAppointmentStatusTranslationKey,
} from './guestAppointmentPresentation';

const statusToneClasses = {
  pending: 'border-primary/25 bg-primary/10 text-primary',
  success: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  danger: 'border-destructive/25 bg-destructive/10 text-destructive',
  muted: 'border-border bg-muted text-muted-foreground',
} as const;

type DetailItemProps = {
  icon: ReactNode;
  label: string;
  value: string;
};

const DetailItem = ({ icon, label, value }: DetailItemProps) => (
  <div className="flex min-w-0 gap-3 rounded-xl border border-border/70 bg-muted/30 p-4">
    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
      {icon}
    </span>
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-medium leading-relaxed text-foreground">{value}</p>
    </div>
  </div>
);

const GuestAppointmentShell = ({ children }: { children: ReactNode }) => {
  const { tenant } = useTenant();
  const { t } = useI18n();
  const brandName = tenant?.config?.branding?.shortName
    || tenant?.config?.branding?.name
    || tenant?.brand?.name
    || 'Managgio';
  const logoUrl = resolveBrandLogo(tenant, managgioLogo);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border/60 bg-card/70 backdrop-blur-sm">
        <div className="mx-auto flex h-16 w-full max-w-4xl items-center px-4 sm:px-6">
          <Link to="/" className="inline-flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <img
              src={logoUrl}
              alt={t('guestAppointment.brandLogoAlt', { brand: brandName })}
              width={40}
              height={40}
              decoding="async"
              className="h-10 w-10 shrink-0 rounded-lg object-contain"
            />
            <span className="truncate text-base font-semibold sm:text-lg">{brandName}</span>
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
        <div className="w-full max-w-2xl">{children}</div>
      </main>

      <footer className="border-t border-border/60 px-4 py-5 text-center text-xs text-muted-foreground">
        <nav aria-label={t('guestAppointment.legalNavigation')} className="flex flex-wrap justify-center gap-x-4 gap-y-2">
          <Link className="transition-colors hover:text-primary" to="/legal/notice">{t('legal.footer.notice')}</Link>
          <Link className="transition-colors hover:text-primary" to="/legal/privacy">{t('legal.footer.privacy')}</Link>
          <Link className="transition-colors hover:text-primary" to="/legal/cookies">{t('legal.footer.cookies')}</Link>
        </nav>
      </footer>
    </div>
  );
};

const AccessError = ({
  error,
  retry,
  forceNotFound = false,
}: {
  error: unknown;
  retry: () => void;
  forceNotFound?: boolean;
}) => {
  const { t } = useI18n();
  const isNotFound = forceNotFound || (isApiRequestError(error) && error.status === 404);
  const isUnavailable = isApiRequestError(error) && error.status === 503;
  const title = isNotFound
    ? t('guestAppointment.error.invalid.title')
    : isUnavailable
      ? t('guestAppointment.error.unavailable.title')
      : t('guestAppointment.error.generic.title');
  const description = isNotFound
    ? t('guestAppointment.error.invalid.description')
    : isUnavailable
      ? t('guestAppointment.error.unavailable.description')
      : t('guestAppointment.error.generic.description');

  return (
    <GuestAppointmentShell>
      <Card variant="elevated">
        <CardContent className="space-y-6 p-6 text-center sm:p-9">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <CalendarX2 className="h-7 w-7" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
            <Button asChild variant="outline">
              <Link to="/">{t('guestAppointment.actions.home')}</Link>
            </Button>
            {!isNotFound && (
              <Button onClick={retry}>
                <RefreshCw aria-hidden="true" />
                {t('guestAppointment.actions.retry')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </GuestAppointmentShell>
  );
};

const LoadingState = () => {
  const { t } = useI18n();
  return (
    <GuestAppointmentShell>
      <Card variant="elevated" aria-busy="true">
        <CardContent className="flex min-h-72 flex-col items-center justify-center gap-4 p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">{t('guestAppointment.loading')}</p>
        </CardContent>
      </Card>
    </GuestAppointmentShell>
  );
};

const GuestAppointmentManagePage = () => {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();
  const { t, language } = useI18n();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const accessQueryKey = queryKeys.guestAppointmentAccess(token);
  const appointmentQuery = useQuery({
    queryKey: accessQueryKey,
    queryFn: () => getGuestAppointmentAccess(token as string),
    enabled: Boolean(token),
    retry: false,
    staleTime: 30_000,
    gcTime: 0,
  });
  const cancelMutation = useMutation({
    mutationFn: () => cancelGuestAppointment(token as string),
    onSuccess: (summary) => {
      queryClient.setQueryData(accessQueryKey, summary);
      setConfirmOpen(false);
    },
    onError: () => {
      setConfirmOpen(false);
      void appointmentQuery.refetch();
    },
  });

  const summary = appointmentQuery.data;
  const formattedDate = useMemo(() => summary ? formatGuestAppointmentDateTime({
    value: summary.startDateTime,
    locale: language,
    timezone: summary.timezone,
  }) : null, [language, summary]);

  if (!token) {
    return <AccessError error={null} forceNotFound retry={() => undefined} />;
  }
  if (appointmentQuery.isPending) return <LoadingState />;
  if (appointmentQuery.isError || !summary) {
    return <AccessError error={appointmentQuery.error} retry={() => void appointmentQuery.refetch()} />;
  }

  const tone = getGuestAppointmentStatusTone(summary.status);
  const reasonKey = getCancellationReasonTranslationKey(summary.cancellationUnavailableReason);
  const professionalName = summary.professionalName || t('guestAppointment.details.professionalPending');
  const dateTime = formattedDate || t('guestAppointment.details.dateUnavailable');

  return (
    <GuestAppointmentShell>
      <Card variant="elevated" className="overflow-hidden">
        <div className="h-1.5 bg-primary" aria-hidden="true" />
        <CardContent className="space-y-7 p-6 sm:p-9">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                {summary.status === 'cancelled'
                  ? <CalendarX2 className="h-6 w-6" aria-hidden="true" />
                  : summary.status === 'completed'
                    ? <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
                    : <CalendarClock className="h-6 w-6" aria-hidden="true" />}
              </div>
              <h1 className="pt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                {t('guestAppointment.title')}
              </h1>
              <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
                {t('guestAppointment.subtitle')}
              </p>
            </div>
            <Badge
              variant="outline"
              className={cn('w-fit shrink-0 px-3 py-1', statusToneClasses[tone])}
            >
              {t(getGuestAppointmentStatusTranslationKey(summary.status))}
            </Badge>
          </div>

          <section aria-labelledby="guest-appointment-details" className="space-y-3">
            <h2 id="guest-appointment-details" className="text-sm font-semibold">
              {t('guestAppointment.details.title')}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailItem
                icon={<CalendarDays className="h-4 w-4" aria-hidden="true" />}
                label={t('guestAppointment.details.date')}
                value={dateTime}
              />
              <DetailItem
                icon={<Layers3 className="h-4 w-4" aria-hidden="true" />}
                label={t('guestAppointment.details.services')}
                value={summary.serviceName}
              />
              <DetailItem
                icon={<UserRound className="h-4 w-4" aria-hidden="true" />}
                label={t('guestAppointment.details.professional')}
                value={professionalName}
              />
              <DetailItem
                icon={<Clock3 className="h-4 w-4" aria-hidden="true" />}
                label={t('guestAppointment.details.duration')}
                value={t('guestAppointment.details.durationMinutes', { minutes: summary.durationMinutes })}
              />
            </div>
          </section>

          <div className={cn(
            'rounded-xl border p-4 text-sm leading-relaxed',
            summary.canCancel
              ? 'border-primary/20 bg-primary/5 text-foreground'
              : 'border-border bg-muted/40 text-muted-foreground',
          )}>
            <p className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span>
                {summary.canCancel
                  ? t('guestAppointment.cancellation.available')
                  : reasonKey
                    ? t(reasonKey)
                    : t('guestAppointment.cancellation.unavailable')}
              </span>
            </p>
          </div>

          {cancelMutation.isError && (
            <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {t('guestAppointment.cancellation.error')}
            </p>
          )}

          <div className="flex flex-col-reverse gap-3 border-t border-border/60 pt-6 sm:flex-row sm:justify-between">
            <Button asChild variant="outline">
              <Link to="/book">{t('guestAppointment.actions.bookAnother')}</Link>
            </Button>

            {summary.canCancel && (
              <AlertDialog open={confirmOpen} onOpenChange={(open) => {
                if (!cancelMutation.isPending) setConfirmOpen(open);
              }}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">{t('guestAppointment.actions.cancel')}</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('guestAppointment.cancellation.confirmTitle')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('guestAppointment.cancellation.confirmDescription', { date: dateTime })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={cancelMutation.isPending}>
                      {t('guestAppointment.actions.keep')}
                    </AlertDialogCancel>
                    <AlertDialogAction
                      disabled={cancelMutation.isPending}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={(event) => {
                        event.preventDefault();
                        cancelMutation.mutate();
                      }}
                    >
                      {cancelMutation.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
                      {t('guestAppointment.actions.confirmCancel')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardContent>
      </Card>
    </GuestAppointmentShell>
  );
};

export default GuestAppointmentManagePage;
