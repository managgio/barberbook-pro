import {
  APP_TIMEZONE,
  formatDateInTimeZone,
  formatTimeInTimeZone,
  getWeekdayKey,
  makeDateInTimeZone,
} from '../../../../utils/timezone';
import {
  BookingDashboardAppointmentSnapshot,
  BookingDashboardBarberSnapshot,
} from '../../ports/outbound/booking-dashboard-read.port';

const DASHBOARD_LOSS_WINDOW_DAYS = 30;
const DASHBOARD_TICKET_WINDOW_DAYS = 14;
const DASHBOARD_OCCUPANCY_START_HOUR = 9;
const DASHBOARD_OCCUPANCY_END_HOUR = 20;
const WEEKDAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const WEEKDAY_INDEX: Record<(typeof WEEKDAY_ORDER)[number], number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
};

const shiftDateInTimeZone = (dateOnly: string, days: number) => {
  const reference = makeDateInTimeZone(dateOnly, { hour: 12, minute: 0 }, APP_TIMEZONE);
  if (Number.isNaN(reference.getTime())) return dateOnly;
  reference.setUTCDate(reference.getUTCDate() + days);
  return formatDateInTimeZone(reference, APP_TIMEZONE);
};

const isDateWithinRange = (dateOnly: string, startDate: string, endDate: string) =>
  dateOnly >= startDate && dateOnly <= endDate;

export const buildBookingDashboardSummary = (params: {
  now: Date;
  windowDays: number;
  barbers: BookingDashboardBarberSnapshot[];
  appointments: BookingDashboardAppointmentSnapshot[];
}) => {
  const todayDate = formatDateInTimeZone(params.now, APP_TIMEZONE);
  const rangeStartDate = shiftDateInTimeZone(todayDate, -(params.windowDays - 1));
  const lossRangeStart = shiftDateInTimeZone(todayDate, -(DASHBOARD_LOSS_WINDOW_DAYS - 1));
  const ticketRangeStart = shiftDateInTimeZone(todayDate, -(DASHBOARD_TICKET_WINDOW_DAYS - 1));
  const todayWeekdayIndex = WEEKDAY_INDEX[getWeekdayKey(todayDate, APP_TIMEZONE)];
  const weekStartDate = shiftDateInTimeZone(todayDate, -(todayWeekdayIndex - 1));
  const weekEndDate = shiftDateInTimeZone(weekStartDate, 6);
  const occupancyHours = Array.from(
    { length: DASHBOARD_OCCUPANCY_END_HOUR - DASHBOARD_OCCUPANCY_START_HOUR + 1 },
    (_, index) => DASHBOARD_OCCUPANCY_START_HOUR + index,
  );

  const todayAppointments: Array<{
    id: string;
    startDateTime: string;
    serviceName: string;
    barberName: string;
    clientName: string;
  }> = [];
  const revenueByDate = new Map<string, number>();
  const serviceMixByName = new Map<string, number>();
  const ticketByDate = new Map<string, { total: number; count: number }>();
  const lossByWeekday = WEEKDAY_ORDER.map((_, index) => ({
    day: index + 1,
    noShow: 0,
    cancelled: 0,
  }));
  const occupancyMatrix = occupancyHours.map(() => Array.from({ length: 7 }, () => 0));
  let maxOccupancy = 1;
  let todayRevenue = 0;
  let weekCancelled = 0;
  let weekNoShow = 0;

  params.appointments.forEach((appointment) => {
    const dateOnly = formatDateInTimeZone(appointment.startDateTime, APP_TIMEZONE);
    const status = appointment.status;
    const isActive = status !== 'cancelled' && status !== 'no_show';
    const isRevenue = status === 'completed';
    const weekdayIndex = WEEKDAY_INDEX[getWeekdayKey(dateOnly, APP_TIMEZONE)];
    const serviceName = appointment.serviceName || appointment.serviceNameSnapshot || 'Servicio eliminado';
    const barberName = appointment.barberName || appointment.barberNameSnapshot || 'Profesional eliminado';
    const clientName = appointment.guestName?.trim() || appointment.userName?.trim() || 'Sin nombre';
    const price = Number(appointment.price || 0);

    if (dateOnly === todayDate && isActive) {
      todayAppointments.push({
        id: appointment.id,
        startDateTime: appointment.startDateTime.toISOString(),
        serviceName,
        barberName,
        clientName,
      });
    }

    if (dateOnly === todayDate && isRevenue) {
      todayRevenue += price;
    }

    if (isDateWithinRange(dateOnly, weekStartDate, weekEndDate) && status === 'cancelled') {
      weekCancelled += 1;
    }
    if (isDateWithinRange(dateOnly, weekStartDate, weekEndDate) && status === 'no_show') {
      weekNoShow += 1;
    }

    if (isRevenue) {
      revenueByDate.set(dateOnly, (revenueByDate.get(dateOnly) || 0) + price);
    }

    if (isRevenue && isDateWithinRange(dateOnly, lossRangeStart, todayDate)) {
      serviceMixByName.set(serviceName, (serviceMixByName.get(serviceName) || 0) + 1);
    }

    if (isRevenue && isDateWithinRange(dateOnly, ticketRangeStart, todayDate)) {
      const current = ticketByDate.get(dateOnly) || { total: 0, count: 0 };
      current.total += price;
      current.count += 1;
      ticketByDate.set(dateOnly, current);
    }

    if (
      isDateWithinRange(dateOnly, lossRangeStart, todayDate) &&
      (status === 'no_show' || status === 'cancelled')
    ) {
      const entry = lossByWeekday[weekdayIndex - 1];
      if (status === 'no_show') {
        entry.noShow += 1;
      } else {
        entry.cancelled += 1;
      }
    }

    if (isActive && isDateWithinRange(dateOnly, lossRangeStart, todayDate)) {
      const hour = Number(formatTimeInTimeZone(appointment.startDateTime, APP_TIMEZONE).slice(0, 2));
      const hourIndex = occupancyHours.indexOf(hour);
      if (hourIndex !== -1) {
        occupancyMatrix[hourIndex][weekdayIndex - 1] += 1;
        maxOccupancy = Math.max(maxOccupancy, occupancyMatrix[hourIndex][weekdayIndex - 1]);
      }
    }
  });

  const revenueDaily: Array<{ date: string; value: number }> = [];
  for (let offset = 0; offset < params.windowDays; offset += 1) {
    const date = shiftDateInTimeZone(rangeStartDate, offset);
    revenueDaily.push({ date, value: Number((revenueByDate.get(date) || 0).toFixed(2)) });
  }

  const serviceMixEntries = Array.from(serviceMixByName.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const serviceMixTop = serviceMixEntries.slice(0, 5);
  const serviceMixOthers = serviceMixEntries
    .slice(5)
    .reduce((sum, item) => sum + item.value, 0);
  const serviceMix =
    serviceMixOthers > 0
      ? [...serviceMixTop, { name: 'Otros', value: serviceMixOthers }]
      : serviceMixTop;

  const ticketDaily: Array<{ date: string; value: number }> = [];
  let ticketAverageAccumulator = 0;
  for (let offset = 0; offset < DASHBOARD_TICKET_WINDOW_DAYS; offset += 1) {
    const date = shiftDateInTimeZone(ticketRangeStart, offset);
    const entry = ticketByDate.get(date);
    const value = entry && entry.count > 0 ? Number((entry.total / entry.count).toFixed(2)) : 0;
    ticketAverageAccumulator += value;
    ticketDaily.push({ date, value });
  }
  const ticketAverage = Number((ticketAverageAccumulator / (ticketDaily.length || 1)).toFixed(2));

  return {
    windowDays: params.windowDays,
    generatedAt: params.now.toISOString(),
    barbers: params.barbers,
    stats: {
      todayAppointments: todayAppointments.length,
      revenueToday: Number(todayRevenue.toFixed(2)),
      weekCancelled,
      weekNoShow,
    },
    todayAppointments,
    revenueDaily,
    serviceMix,
    ticketDaily,
    ticketAverage,
    lossByWeekday,
    occupancy: {
      hours: occupancyHours,
      matrix: occupancyMatrix,
      max: maxOccupancy,
    },
  };
};
