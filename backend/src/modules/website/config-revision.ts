import { createHash } from 'node:crypto';

const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== '_revision').sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)])) : value;
export const configRevision = (value: unknown) => createHash('sha256').update(JSON.stringify(canonical(value ?? {}))).digest('hex');
