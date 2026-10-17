import { describe, expect, it, vi } from 'vitest';
import {
  buildCalendarIcs,
  buildGoogleCalendarUrl,
  detectCalendarDevice,
} from './calendarIntegration';

const event = {
  id: 'appointment-1',
  title: 'Corte, color',
  start: new Date('2026-10-20T08:30:00.000Z'),
  end: new Date('2026-10-20T09:15:00.000Z'),
  description: 'Con Alex; trae foto',
  location: 'Valencia, España',
};

describe('calendarIntegration', () => {
  it('detects Android and Apple devices, including iPad desktop mode', () => {
    expect(detectCalendarDevice({ userAgent: 'Mozilla/5.0 (Linux; Android 15)', platform: 'Linux', maxTouchPoints: 5 })).toBe('android');
    expect(detectCalendarDevice({ userAgent: 'Mozilla/5.0 (iPhone)', platform: 'iPhone', maxTouchPoints: 5 })).toBe('apple');
    expect(detectCalendarDevice({ userAgent: 'Mozilla/5.0 Safari', platform: 'MacIntel', maxTouchPoints: 5 })).toBe('apple');
    expect(detectCalendarDevice({ userAgent: 'Mozilla/5.0 Windows', platform: 'Win32', maxTouchPoints: 0 })).toBe('other');
  });

  it('builds a Google Calendar event with exact UTC bounds', () => {
    const url = new URL(buildGoogleCalendarUrl(event));
    expect(url.origin).toBe('https://calendar.google.com');
    expect(url.searchParams.get('dates')).toBe('20261020T083000Z/20261020T091500Z');
    expect(url.searchParams.get('text')).toBe(event.title);
  });

  it('builds an Apple-compatible ICS file and escapes reserved text', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-17T10:00:00.000Z'));
    const ics = buildCalendarIcs(event);
    expect(ics).toContain('DTSTART:20261020T083000Z');
    expect(ics).toContain('DTEND:20261020T091500Z');
    expect(ics).toContain('SUMMARY:Corte\\, color');
    expect(ics).toContain('DESCRIPTION:Con Alex\\; trae foto');
    expect(ics).toContain('LOCATION:Valencia\\, España');
    vi.useRealTimers();
  });
});
