export const DEFAULT_LOCATION_TIMEZONE = 'Europe/Madrid';

export const LOCATION_TIMEZONE_OPTIONS = [
  'Europe/Madrid',
  'Atlantic/Canary',
  'Europe/Lisbon',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Rome',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Mexico_City',
  'America/Bogota',
  'America/Lima',
  'America/Santiago',
  'America/Argentina/Buenos_Aires',
  'America/Sao_Paulo',
  'UTC',
] as const;

export const isValidIanaTimeZone = (value: string) => {
  try {
    new Intl.DateTimeFormat('es-ES', { timeZone: value.trim() }).format();
    return value.trim().length > 0;
  } catch {
    return false;
  }
};
