import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  getHolidaysGeneral,
  addGeneralHolidayRange,
  removeGeneralHolidayRange,
  getHolidaysByBarber,
  addBarberHolidayRange,
  removeBarberHolidayRange,
} from '@/data/api/holidays';
import { Barber, HolidayRange } from '@/data/types';
import { format } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { Calendar } from '@/components/ui/calendar';
import { dispatchHolidaysUpdated } from '@/lib/adminEvents';
import { useBusinessCopy } from '@/lib/businessCopy';
import { fetchBarbersCached } from '@/lib/catalogQuery';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useTenant } from '@/context/TenantContext';
import { useForegroundRefresh } from '@/hooks/useForegroundRefresh';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/hooks/useI18n';
import { resolveDateLocale } from '@/lib/i18n';

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
      setMonthsToShow(width >= 1024 && width < 1280 ? 1 : 2);
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

  const handleAddGeneralHoliday = async () => {
    const payload = rangeToPayload(generalRange);
    if (!payload) return;
    const updated = await addGeneralHolidayRange(payload);
    queryClient.setQueryData(queryKeys.adminGeneralHolidays(currentLocationId), updated);
    setGeneralRange(undefined);
    dispatchHolidaysUpdated({ source: 'admin-holidays' });
  };

  const handleRemoveGeneralHoliday = async (range: HolidayRange) => {
    const updated = await removeGeneralHolidayRange(range);
    queryClient.setQueryData(queryKeys.adminGeneralHolidays(currentLocationId), updated);
    dispatchHolidaysUpdated({ source: 'admin-holidays' });
  };

  const handleAddBarberHoliday = async () => {
    const payload = rangeToPayload(barberRange);
    if (!payload || !selectedBarber) return;
    const updated = await addBarberHolidayRange(selectedBarber, payload);
    queryClient.setQueryData(queryKeys.adminBarberHolidays(currentLocationId, selectedBarber), updated);
    setBarberRange(undefined);
    dispatchHolidaysUpdated({ source: 'admin-holidays' });
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

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.holidays.general.title', { locationFromWithDefinite: copy.location.fromWithDefinite })}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border rounded-2xl p-4 bg-card/60">
              <Calendar
                mode="range"
                numberOfMonths={monthsToShow}
                selected={generalRange}
                onSelect={setGeneralRange}
                className="mx-auto"
              />
              <p className="text-xs text-muted-foreground text-center mt-3">
                {t('admin.holidays.general.calendarHint')}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleAddGeneralHoliday} disabled={!generalRange?.from}>
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

        <Card>
          <CardHeader>
            <CardTitle>{t('admin.holidays.byStaff.title', { staffSingularLower: copy.staff.singularLower })}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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

            <div className="border rounded-2xl p-4 bg-card/60">
              <Calendar
                mode="range"
                numberOfMonths={monthsToShow}
                selected={barberRange}
                onSelect={setBarberRange}
                className="mx-auto"
              />
              <p className="text-xs text-muted-foreground text-center mt-3">
                {t('admin.holidays.byStaff.calendarHint', { staffFromWithDefinite: copy.staff.fromWithDefinite })}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleAddBarberHoliday}
                disabled={!barberRange?.from || !selectedBarber}
              >
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
      </div>
    </div>
  );
};

export default AdminHolidays;
