import { Alert } from '@prisma/client';

export const mapAlert = (alert: Alert) => ({
  id: alert.id,
  title: alert.title,
  message: alert.message,
  active: alert.active,
  type: alert.type,
});
