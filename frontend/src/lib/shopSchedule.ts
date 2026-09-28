import type { DayKey, ShopSchedule } from '@/data/types';

const DAY_KEYS: DayKey[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export const mergeShopScheduleAvailability = (
  schedule: ShopSchedule,
  openingHours: ShopSchedule,
): ShopSchedule => {
  const merged = { ...schedule };
  DAY_KEYS.forEach((day) => {
    merged[day] = openingHours[day];
  });
  return merged;
};
