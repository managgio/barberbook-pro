import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  getBarbers,
  getHolidaysGeneral,
  addGeneralHolidayRange,
  removeGeneralHolidayRange,
  getHolidaysByBarber,
  addBarberHolidayRange,
  removeBarberHolidayRange,
} from '@/data/api';
import { Barber, HolidayRange } from '@/data/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { Calendar } from '@/components/ui/calendar';
import { ADMIN_EVENTS, dispatchHolidaysUpdated } from '@/lib/adminEvents';
import { useBusinessCopy } from '@/lib/businessCopy';

const AdminHolidays: React.FC = () => {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [generalHolidays, setGeneralHolidays] = useState<HolidayRange[]>([]);
  const [barberHolidays, setBarberHolidays] = useState<HolidayRange[]>([]);
  const [generalRange, setGeneralRange] = useState<DateRange | undefined>();
  const [barberRange, setBarberRange] = useState<DateRange | undefined>();
  const [monthsToShow, setMonthsToShow] = useState(2);
  const [selectedBarber, setSelectedBarber] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const copy = useBusinessCopy();

  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [holidays, barbersData] = await Promise.all([
        getHolidaysGeneral(),
        getBarbers(),
      ]);
      setGeneralHolidays(holidays);
      setBarbers(barbersData);
      setSelectedBarber((prev) => prev || barbersData[0]?.id || '');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshGeneralHolidays = useCallback(async () => {
    const holidays = await getHolidaysGeneral();
    setGeneralHolidays(holidays);
  }, []);

  const refreshBarberHolidays = useCallback(async (barberId: string) => {
    const holidays = await getHolidaysByBarber(barberId);
    setBarberHolidays(holidays);
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

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

  useEffect(() => {
    if (!selectedBarber) {
      setBarberHolidays([]);
      return;
    }
    void refreshBarberHolidays(selectedBarber);
  }, [selectedBarber, refreshBarberHolidays]);

  useEffect(() => {
    const handleRefresh = () => {
      void refreshGeneralHolidays();
      if (selectedBarber) {
        void refreshBarberHolidays(selectedBarber);
      }
    };
    window.addEventListener(ADMIN_EVENTS.holidaysUpdated, handleRefresh);
    return () => window.removeEventListener(ADMIN_EVENTS.holidaysUpdated, handleRefresh);
  }, [refreshGeneralHolidays, refreshBarberHolidays, selectedBarber]);

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
    setGeneralHolidays(updated);
    setGeneralRange(undefined);
    dispatchHolidaysUpdated({ source: 'admin-holidays' });
  };

  const handleRemoveGeneralHoliday = async (range: HolidayRange) => {
    const updated = await removeGeneralHolidayRange(range);
    setGeneralHolidays(updated);
    dispatchHolidaysUpdated({ source: 'admin-holidays' });
  };

  const handleAddBarberHoliday = async () => {
    const payload = rangeToPayload(barberRange);
    if (!payload || !selectedBarber) return;
    const updated = await addBarberHolidayRange(selectedBarber, payload);
    setBarberHolidays(updated);
    setBarberRange(undefined);
    dispatchHolidaysUpdated({ source: 'admin-holidays' });
  };

  const handleRemoveBarberHoliday = async (range: HolidayRange) => {
    if (!selectedBarber) return;
    const updated = await removeBarberHolidayRange(selectedBarber, range);
    setBarberHolidays(updated);
    dispatchHolidaysUpdated({ source: 'admin-holidays' });
  };

  const formatRangeLabel = (range: HolidayRange) => {
    const start = format(new Date(range.start), "dd MMM yyyy", { locale: es });
    const end = format(new Date(range.end), "dd MMM yyyy", { locale: es });
    return range.start === range.end ? start : `${start} - ${end}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Festivos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Cargando...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="pl-12 md:pl-0">
        <h1 className="text-3xl font-bold text-foreground">Festivos</h1>
        <p className="text-muted-foreground mt-1">
          Administra los días no laborables generales y por {copy.staff.singularLower}.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Festivos {copy.location.fromWithDefinite}</CardTitle>
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
                Selecciona un día o un rango completo. Las fechas son inclusivas.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleAddGeneralHoliday} disabled={!generalRange?.from}>
                Bloquear fechas
              </Button>
              <Button variant="outline" onClick={() => setGeneralRange(undefined)}>
                Limpiar selección
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {generalHolidays.length === 0 && (
                <p className="text-sm text-muted-foreground">No hay festivos configurados.</p>
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
            <CardTitle>Festivos por {copy.staff.singularLower}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedBarber} onValueChange={setSelectedBarber}>
              <SelectTrigger>
                <SelectValue placeholder={`Selecciona ${copy.staff.indefiniteSingular}`} />
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
                Selecciona uno o varios días para bloquear la disponibilidad {copy.staff.fromWithDefinite}.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleAddBarberHoliday}
                disabled={!barberRange?.from || !selectedBarber}
              >
                Bloquear fechas
              </Button>
              <Button variant="outline" onClick={() => setBarberRange(undefined)}>
                Limpiar selección
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {barberHolidays.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {selectedBarber
                    ? `No hay festivos asignados ${copy.staff.toWithDefinite}.`
                    : `Selecciona ${copy.staff.indefiniteSingular}.`}
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
