export type LoyaltyProgress = {
  totalVisits: number;
  totalVisitsAccumulated: number;
  cycleVisits: number;
  nextFreeIn: number;
  isRewardNext: boolean;
};

export const buildLoyaltyProgress = (params: {
  requiredVisits: number;
  totalVisitsAccumulated: number;
}): LoyaltyProgress => {
  const totalVisits = Math.max(1, Math.floor(params.requiredVisits));
  const cycleVisits = params.totalVisitsAccumulated % totalVisits;
  const nextFreeIn = totalVisits - cycleVisits;
  const isRewardNext = cycleVisits === totalVisits - 1;
  return {
    totalVisits,
    totalVisitsAccumulated: params.totalVisitsAccumulated,
    cycleVisits,
    nextFreeIn,
    isRewardNext,
  };
};

export const isNextLoyaltyVisitFree = (params: {
  requiredVisits: number;
  totalVisitsAccumulated: number;
  activeVisits: number;
}): boolean => {
  const progress = buildLoyaltyProgress({
    requiredVisits: params.requiredVisits,
    totalVisitsAccumulated: params.totalVisitsAccumulated,
  });
  const nextIndex = params.activeVisits + 1;
  return nextIndex % progress.totalVisits === 0;
};
