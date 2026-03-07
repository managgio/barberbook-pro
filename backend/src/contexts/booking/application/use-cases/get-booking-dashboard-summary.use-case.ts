import { ClockPort } from '../../../../shared/application/clock.port';
import { APP_TIMEZONE, formatDateInTimeZone, makeDateInTimeZone } from '../../../../utils/timezone';
import { buildBookingDashboardSummary } from '../../domain/services/booking-dashboard-summary.policy';
import { BookingDashboardReadPort } from '../../ports/outbound/booking-dashboard-read.port';
import { GetBookingDashboardSummaryQuery } from '../queries/get-booking-dashboard-summary.query';

const DASHBOARD_DEFAULT_WINDOW_DAYS = 30;
const DASHBOARD_MIN_WINDOW_DAYS = 7;
const DASHBOARD_MAX_WINDOW_DAYS = 60;
const DASHBOARD_LOSS_WINDOW_DAYS = 30;
const DASHBOARD_TICKET_WINDOW_DAYS = 14;

const shiftDateInTimeZone = (dateOnly: string, days: number) => {
  const reference = makeDateInTimeZone(dateOnly, { hour: 12, minute: 0 }, APP_TIMEZONE);
  if (Number.isNaN(reference.getTime())) return dateOnly;
  reference.setUTCDate(reference.getUTCDate() + days);
  return formatDateInTimeZone(reference, APP_TIMEZONE);
};

export class GetBookingDashboardSummaryUseCase {
  constructor(
    private readonly bookingDashboardReadPort: BookingDashboardReadPort,
    private readonly clockPort: ClockPort,
  ) {}

  async execute(query: GetBookingDashboardSummaryQuery) {
    const windowDays = Math.min(
      DASHBOARD_MAX_WINDOW_DAYS,
      Math.max(
        DASHBOARD_MIN_WINDOW_DAYS,
        Math.floor(query.windowDays ?? DASHBOARD_DEFAULT_WINDOW_DAYS),
      ),
    );
    const selectedBarberId = query.barberId?.trim() || undefined;
    const now = this.clockPort.now();
    const todayDate = formatDateInTimeZone(now, APP_TIMEZONE);
    const queryWindowDays = Math.max(windowDays, DASHBOARD_LOSS_WINDOW_DAYS, DASHBOARD_TICKET_WINDOW_DAYS);
    const queryRangeStartDate = shiftDateInTimeZone(todayDate, -(queryWindowDays - 1));

    const snapshot = await this.bookingDashboardReadPort.readDashboardSnapshot({
      localId: query.context.localId,
      dateFrom: queryRangeStartDate,
      dateTo: todayDate,
      barberId: selectedBarberId,
    });

    return buildBookingDashboardSummary({
      now,
      windowDays,
      barbers: snapshot.barbers,
      appointments: snapshot.appointments,
    });
  }
}
