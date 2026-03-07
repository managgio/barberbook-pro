type OfferDateWindow = {
  active: boolean;
  startDate: Date | null;
  endDate: Date | null;
};

export const isOfferActiveNow = (offer: OfferDateWindow, now: Date = new Date()): boolean => {
  if (!offer.active) return false;

  if (offer.startDate) {
    const start = new Date(offer.startDate);
    start.setHours(0, 0, 0, 0);
    if (now < start) return false;
  }

  if (offer.endDate) {
    const end = new Date(offer.endDate);
    end.setHours(23, 59, 59, 999);
    if (now > end) return false;
  }

  return true;
};
