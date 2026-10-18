export type PhotoRect = { left: number; top: number; width: number; height: number };

export function nearestPhotoSlot(rects: PhotoRect[], x: number, y: number) {
  let closest = 0, distance = Infinity;
  rects.forEach((rect, index) => {
    const next = Math.hypot(x - rect.left - rect.width / 2, y - rect.top - rect.height / 2);
    if (next < distance) { distance = next; closest = index; }
  });
  return closest;
}

export function photoSlotForItem(index: number, from: number, to: number) {
  if (index === from) return to;
  if (from < to && index > from && index <= to) return index - 1;
  if (from > to && index < from && index >= to) return index + 1;
  return index;
}
