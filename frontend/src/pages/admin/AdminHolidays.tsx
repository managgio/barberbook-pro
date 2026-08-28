import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  getHolidaysGeneral,
  addGeneralHolidayRange,
  removeGeneralHolidayRange,
  getHolidaysByBarber,
  addBarberHolidayRange,
  removeBarberHolidayRange,
  getHolidayAppointmentImpact,
  notifyAndCancelHolidayAppointments,
} from '@/data/api/holidays';
import { Barber, HolidayAppointmentImpact, HolidayRange } from '@/data/types';
import { format } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { Calendar } from '@/components/ui/calendar';
import { dispatchAppointmentsUpdated, dispatchHolidaysUpdated } from '@/lib/adminEvents';
import { useBusinessCopy } from '@/lib/businessCopy';
import { fetchBarbersCached } from '@/lib/catalogQuery';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useTenant } from '@/context/TenantContext';
import { useForegroundRefresh } from '@/hooks/useForegroundRefresh';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/hooks/useI18n';
import { resolveDateLocale } from '@/lib/i18n';
import { Loader2 } from 'lucide-react';
import {
  HolidayConflictDialog,
  PendingHoliday,
} from '@/components/admin/holidays/HolidayConflictDialog';

const EMPTY_BARBERS: Barber[] = [];
const EMPTY_HOLIDAYS: HolidayRange[] = [];

const AdminHolidays: React.FC = () => {
  const { currentLocationId } = useTenant();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const copy = useBusinessCopy();
  const { t, language } = useI18n();
  const dateLocale = resolveDateLocale(language);
  const [generalRange, setGeneralRange] = useState<DateRange | undefined>();
  const [barberRange, setBarberRange] = useState<DateRange | undefined>();
  const [monthsToShow, setMonthsToShow] = useState(2);
  const [selectedBarber, setSelectedBarber] = useState<string>('');
  const [pendingHoliday, setPendingHoliday] = useState<PendingHoliday | null>(null);
  const [holidayAction, setHolidayAction] = useState<'checking' | 'saving' | 'notifying' | null>(null);

  const barbersQuery = useQuery({
    queryKey: queryKeys.barbers(currentLocationId, undefined, true),
    queryFn: () => fetchBarbersCached({ localId: currentLocationId, includeInactive: true }),
  });
  const generalHolidaysQuery = useQuery({
    queryKey: queryKeys.adminGeneralHolidays(currentLocationId),
    queryFn: getHolidaysGeneral,
  });
  const barberHolidaysQuery = useQuery({
    queryKey: queryKeys.adminBarberHolidays(currentLocationId, selectedBarber),
    queryFn: () => getHolidaysByBarber(selectedBarber),
    enabled: Boolean(selectedBarber),
  });
  const barbers = barbersQuery.data ?? EMPTY_BARBERS;
  const generalHolidays = generalHolidaysQuery.data ?? EMPTY_HOLIDAYS;
  const barberHolidays = barberHolidaysQuery.data ?? EMPTY_HOLIDAYS;
  const isLoading =
    barbersQuery.isLoading ||
    generalHolidaysQuery.isLoading ||
    (Boolean(selectedBarber) && barberHolidaysQuery.isLoading);

  useEffect(() => {
    if (!selectedBarber) {
      setSelectedBarber(barbers[0]?.id ?? '');
      return;
    }
    if (!barbers.some((barber) => barber.id === selectedBarber)) {
      setSelectedBarber(barbers[0]?.id ?? '');
    }
  }, [barbers, selectedBarber]);

  useEffect(() => {
    if (!barbersQuery.error && !generalHolidaysQuery.error && !barberHolidaysQuery.error) return;
    toast({
      title: t('admin.holidays.toast.loadErrorTitle'),
      description: t('admin.common.tryAgainInSeconds'),
      variant: 'destructive',
    });
  }, [barberHolidaysQuery.error, barbersQuery.error, generalHolidaysQuery.error, t, toast]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleChange = () => {
      const width = window.innerWidth;
      if (width >= 2100) {
        setMonthsToShow(5);
        return;
      }
      if (width >= 1500) {
        setMonthsToShow(4);
        return;
      }
      if (width >= 1024) {
        setMonthsToShow(3);
        return;
      }
      if (width >= 768) {
        setMonthsToShow(2);
        return;
      }
      setMonthsToShow(1);
    };
    handleChange();
    window.addEventListener('resize', handleChange);
    return () => window.removeEventListener('resize', handleChange);
  }, []);

  useForegroundRefresh(() => {
    void Promise.all([
      barbersQuery.refetch(),
      generalHolidaysQuery.refetch(),
      selectedBarber ? barberHolidaysQuery.refetch() : Promise.resolve(),
    ]);
  });

  const rangeToPayload = (range?: DateRange): HolidayRange | null => {
    if (!range?.from) return null;
    const start = format(range.from, 'yyyy-MM-dd');
    const end = range.to ? format(range.to, 'yyyy-MM-dd') : start;
    if (end < start) {
      return { start: end, end: start };
    }
    return { start, end };
  };

  const persistHolidayWithoutNotification = async (holiday: {
    type: 'general' | 'barber';
    range: HolidayRange;
    barberId?: string;
  }) => {
    if (holiday.type === 'general') {
      const updated = await addGeneralHolidayRange(holiday.range);
      queryClient.setQueryData(queryKeys.adminGeneralHolidays(currentLocationId), updated);
      setGeneralRange(undefined);
    } else if (holiday.barberId) {
      const updated = await addBarberHolidayRange(holiday.barberId, holiday.range);
      queryClient.setQueryData(
        queryKeys.adminBarberHolidays(currentLocationId, holiday.barberId),
        updated,
      );
      setBarberRange(undefined);
    }
    dispatchHolidaysUpdated({ source: 'admin-holidays', localId: currentLocationId });
  };

  const prepareHoliday = async (holiday: {
    type: 'general' | 'barber';
    range: HolidayRange;
    barberId?: string;
  }) => {
    setHolidayAction('checking');
    let impact: HolidayAppointmentImpact;
    try {
      impact = await getHolidayAppointmentImpact(holiday);
    } catch {
      toast({
        title: t('admin.holidays.toast.impactErrorTitle'),
        description: t('admin.holidays.toast.impactErrorDescription'),
        variant: 'destructive',
      });
      setHolidayAction(null);
      return;
    }

    if (impact.appointmentsAffected === 0) {
      try {
        await persistHolidayWithoutNotification(holiday);
        toast({
          title: t('admin.holidays.toast.savedTitle'),
          description: t('admin.holidays.toast.savedWithoutAppointments'),
        });
      } catch {
        toast({
          title: t('admin.holidays.toast.saveErrorTitle'),
          description: t('admin.common.tryAgainInSeconds'),
          variant: 'destructive',
        });
      }
      setHolidayAction(null);
      return;
    }

    setPendingHoliday({ ...holiday, impact });
    setHolidayAction(null);
  };

  const handleAddGeneralHoliday = async () => {
    const range = rangeToPayload(generalRange);
    if (!range) return;
    await prepareHoliday({ type: 'general', range });
  };

  const handleRemoveGeneralHoliday = async (range: HolidayRange) => {
    const updated = await removeGeneralHolidayRange(range);
    queryClient.setQueryData(queryKeys.adminGeneralHolidays(currentLocationId), updated);
    dispatchHolidaysUpdated({ source: 'admin-holidays' });
  };

  const handleAddBarberHoliday = async () => {
    const range = rangeToPayload(barberRange);
    if (!range || !selectedBarber) return;
    await prepareHoliday({ type: 'barber', range, barberId: selectedBarber });
  };

  const handleSaveWithoutNotification = async () => {
    if (!pendingHoliday) return;
    setHolidayAction('saving');
    try {
      await persistHolidayWithoutNotification(pendingHoliday);
      setPendingHoliday(null);
      toast({
        title: t('admin.holidays.toast.savedTitle'),
        description: t('admin.holidays.toast.savedKeepingAppointments'),
      });
    } catch {
      toast({
        title: t('admin.holidays.toast.saveErrorTitle'),
        description: t('admin.common.tryAgainInSeconds'),
        variant: 'destructive',
      });
    } finally {
      setHolidayAction(null);
    }
  };

  const handleNotifyAndCancel = async () => {
    if (!pendingHoliday) return;
    setHolidayAction('notifying');
    try {
      await notifyAndCancelHolidayAppointments({
        type: pendingHoliday.type,
        range: pendingHoliday.range,
        barberId: pendingHoliday.barberId,
        idempotencyKey:
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `holiday-${Date.now()}`,
      });
      if (pendingHoliday.type === 'general') {
        await generalHolidaysQuery.refetch();
        setGeneralRange(undefined);
      } else {
        await barberHolidaysQuery.refetch();
        setBarberRange(undefined);
      }
      dispatchAppointmentsUpdated({ source: 'admin-holidays', localId: currentLocationId });
      dispatchHolidaysUpdated({ source: 'admin-holidays', localId: currentLocationId });
      setPendingHoliday(null);
      toast({
        title: t('admin.holidays.toast.notifiedTitle'),
        description: t('admin.holidays.toast.notifiedDescription', {
          count: pendingHoliday.impact.appointmentsAffected,
        }),
      });
    } catch {
      toast({
        title: t('admin.holidays.toast.notifyErrorTitle'),
        description: t('admin.holidays.toast.notifyErrorDescription'),
        variant: 'destructive',
      });
    } finally {
      setHolidayAction(null);
    }
  };

  const handleRemoveBarberHoliday = async (range: HolidayRange) => {
    if (!selectedBarber) return;
    const updated = await removeBarberHolidayRange(selectedBarber, range);
    queryClient.setQueryData(queryKeys.adminBarberHolidays(currentLocationId, selectedBarber), updated);
    dispatchHolidaysUpdated({ source: 'admin-holidays' });
  };

  const formatRangeLabel = (range: HolidayRange) => {
    const start = format(new Date(range.start), "dd MMM yyyy", { locale: dateLocale });
    const end = format(new Date(range.end), "dd MMM yyyy", { locale: dateLocale });
    return range.start === range.end ? start : `${start} - ${end}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.holidays.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{t('admin.holidays.loading')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="pl-12 md:pl-0">
        <h1 className="text-3xl font-bold text-foreground">{t('admin.holidays.title')}</h1>
        <p className="text-muted-foreground mt-1">
          {t('admin.holidays.subtitle', { staffSingularLower: copy.staff.singularLower })}
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full sm:w-[360px] grid-cols-2">
          <TabsTrigger value="general">{t('admin.holidays.tabs.general')}</TabsTrigger>
          <TabsTrigger value="byStaff">{t('admin.holidays.tabs.byStaff')}</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>{t('admin.holidays.general.title', { locationFromWithDefinite: copy.location.fromWithDefinite })}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border rounded-2xl p-4 bg-card/60">
                <div className="flex justify-center">
                  <Calendar
                    mode="range"
                    numberOfMonths={monthsToShow}
                    selected={generalRange}
                    onSelect={setGeneralRange}
                    locale={dateLocale}
                    weekStartsOn={1}
                    className="mx-auto w-fit"
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center mt-3">
                  {t('admin.holidays.general.calendarHint')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleAddGeneralHoliday}
                  disabled={!generalRange?.from || holidayAction === 'checking'}
                >
                  {holidayAction === 'checking' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('admin.holidays.actions.blockDates')}
                </Button>
                <Button variant="outline" onClick={() => setGeneralRange(undefined)}>
                  {t('admin.holidays.actions.clearSelection')}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {generalHolidays.length === 0 && (
                  <p className="text-sm text-muted-foreground">{t('admin.holidays.general.empty')}</p>
                )}
                {generalHolidays.map((range, index) => (
                  <div
                    key={`${range.start}-${range.end}-${index}`}
                    className="flex items-center gap-2 rounded-full bg-secondary px-4 py-1 text-sm"
                  >
                    <span>{formatRangeLabel(range)}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => handleRemoveGeneralHoliday(range)}
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="byStaff" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>{t('admin.holidays.byStaff.title', { staffSingularLower: copy.staff.singularLower })}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="w-full max-w-[360px]">
                <Select value={selectedBarber} onValueChange={setSelectedBarber}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('common.selectNoun', { noun: copy.staff.indefiniteSingular })} />
                  </SelectTrigger>
                  <SelectContent>
                    {barbers.map((barber) => (
                      <SelectItem key={barber.id} value={barber.id}>
                        {barber.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="border rounded-2xl p-4 bg-card/60">
                <div className="flex justify-center">
                  <Calendar
                    mode="range"
                    numberOfMonths={monthsToShow}
                    selected={barberRange}
                    onSelect={setBarberRange}
                    locale={dateLocale}
                    weekStartsOn={1}
                    className="mx-auto w-fit"
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center mt-3">
                  {t('admin.holidays.byStaff.calendarHint', { staffFromWithDefinite: copy.staff.fromWithDefinite })}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleAddBarberHoliday}
                  disabled={!barberRange?.from || !selectedBarber || holidayAction === 'checking'}
                >
                  {holidayAction === 'checking' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('admin.holidays.actions.blockDates')}
                </Button>
                <Button variant="outline" onClick={() => setBarberRange(undefined)}>
                  {t('admin.holidays.actions.clearSelection')}
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {barberHolidays.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {selectedBarber
                      ? t('admin.holidays.byStaff.emptyWithSelection', { staffToWithDefinite: copy.staff.toWithDefinite })
                      : t('common.selectNoun', { noun: copy.staff.indefiniteSingular })}
                  </p>
                )}
                {barberHolidays.map((range, index) => (
                  <div
                    key={`${range.start}-${range.end}-${index}`}
                    className="flex items-center gap-2 rounded-full bg-secondary px-4 py-1 text-sm"
                  >
                    <span>{formatRangeLabel(range)}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => handleRemoveBarberHoliday(range)}
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <HolidayConflictDialog
        pendingHoliday={pendingHoliday}
        action={holidayAction}
        onClose={() => setPendingHoliday(null)}
        onSaveWithoutNotification={handleSaveWithoutNotification}
        onNotifyAndCancel={handleNotifyAndCancel}
      />
    </div>
  );
};

export default AdminHolidays;
