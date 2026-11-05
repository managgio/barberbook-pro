import { useEffect, useMemo, useRef, useState } from 'react';
import type { ShopSchedule } from '@/data/types';
import { mergeShopScheduleAvailability } from '@/lib/shopSchedule';

const sameSchedule = (left: ShopSchedule | null, right: ShopSchedule | null) =>
  JSON.stringify(left) === JSON.stringify(right);

type DraftState = {
  scope: string | null;
  draft: ShopSchedule | null;
  baseline: ShopSchedule | null;
  latest: ShopSchedule | null;
};

export const useAgendaDraft = (
  scope: string | null,
  schedule?: ShopSchedule,
  openingHours?: ShopSchedule,
) => {
  const source = useMemo(() => schedule && openingHours
    ? mergeShopScheduleAvailability(schedule, openingHours) : null, [schedule, openingHours]);
  const [state, setState] = useState<DraftState>({ scope, draft: source, baseline: source, latest: source });
  const currentScope = useRef(scope);
  currentScope.current = scope;

  useEffect(() => {
    setState((current) => {
      if (current.scope !== scope) return { scope, draft: source, baseline: source, latest: source };
      if (!source) return current;
      const pristine = sameSchedule(current.draft, current.baseline);
      return {
        ...current,
        latest: source,
        ...(pristine ? { draft: source, baseline: source } : {}),
      };
    });
  }, [source, scope]);

  const draft = state.scope === scope ? state.draft : null;
  const dirty = Boolean(draft && !sameSchedule(draft, state.baseline));
  const update = (next: ShopSchedule) => setState((current) => current.scope === scope
    ? { ...current, draft: next } : current);
  const discard = () => setState((current) => ({
    ...current, draft: current.latest, baseline: current.latest,
  }));
  const acceptSaved = (saved: ShopSchedule, savedScope: string | null) => {
    if (currentScope.current !== savedScope) return;
    setState({ scope: savedScope, draft: saved, baseline: saved, latest: saved });
  };

  return { draft, dirty, update, discard, acceptSaved };
};
