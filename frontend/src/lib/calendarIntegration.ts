export type CalendarDevice = 'apple' | 'android' | 'other';

export type CalendarEventInput = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  description?: string;
  location?: string;
};

type NavigatorFingerprint = Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'>;

const formatUtc = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

export const escapeIcsText = (value: string) => value
  .replace(/\\/g, '\\\\')
  .replace(/\r?\n/g, '\\n')
  .replace(/,/g, '\\,')
  .replace(/;/g, '\\;');

export const detectCalendarDevice = (fingerprint: NavigatorFingerprint): CalendarDevice => {
  const userAgent = fingerprint.userAgent || '';
  const platform = fingerprint.platform || '';
  if (/android/i.test(userAgent)) return 'android';
  const isAppleMobile = /iphone|ipad|ipod/i.test(userAgent);
  const isIpadDesktopMode = /mac/i.test(platform) && fingerprint.maxTouchPoints > 1;
  if (isAppleMobile || isIpadDesktopMode || /mac/i.test(platform)) return 'apple';
  return 'other';
};

export const buildGoogleCalendarUrl = (event: CalendarEventInput) => {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${formatUtc(event.start)}/${formatUtc(event.end)}`,
    details: event.description || '',
    location: event.location || '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

export const buildCalendarIcs = (event: CalendarEventInput) => [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Managgio//Appointments//ES',
  'CALSCALE:GREGORIAN',
  'METHOD:PUBLISH',
  'BEGIN:VEVENT',
  `UID:${escapeIcsText(event.id)}@managgio.app`,
  `DTSTAMP:${formatUtc(new Date())}`,
  `DTSTART:${formatUtc(event.start)}`,
  `DTEND:${formatUtc(event.end)}`,
  `SUMMARY:${escapeIcsText(event.title)}`,
  `DESCRIPTION:${escapeIcsText(event.description || '')}`,
  `LOCATION:${escapeIcsText(event.location || '')}`,
  'END:VEVENT',
  'END:VCALENDAR',
  '',
].join('\r\n');

const openIcsFile = (event: CalendarEventInput) => {
  const blob = new Blob([buildCalendarIcs(event)], { type: 'text/calendar;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = `cita-${event.start.toISOString().slice(0, 10)}.ics`;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
};

export const openCalendarForDevice = (
  event: CalendarEventInput,
  fingerprint: NavigatorFingerprint = navigator,
) => {
  const device = detectCalendarDevice(fingerprint);
  if (device === 'android') {
    window.location.assign(buildGoogleCalendarUrl(event));
    return device;
  }
  openIcsFile(event);
  return device;
};
