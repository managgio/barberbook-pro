type AlertLike = {
  id: string;
  title: string;
  message: string;
  active: boolean;
  type: string;
  startDate: Date | null;
  endDate: Date | null;
};

export const mapAlert = (alert: AlertLike) => ({
  id: alert.id,
  title: alert.title,
  message: alert.message,
  active: alert.active,
  type: alert.type,
  startDate: alert.startDate,
  endDate: alert.endDate,
});
