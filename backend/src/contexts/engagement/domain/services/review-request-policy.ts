import { DomainError } from '../../../../shared/domain/domain-error';

export type ReviewState = 'PENDING' | 'ELIGIBLE' | 'SHOWN' | 'RATED' | 'DISMISSED' | 'CLICKED' | 'COMPLETED' | 'EXPIRED';
export type ReviewSnapshot = {
  status: ReviewState;
  rating: number | null;
  privateFeedback: string | null;
  snoozeCount: number;
  eligibleAt: Date;
  shownAt: Date | null;
  ratedAt: Date | null;
  clickedAt: Date | null;
  completedAt: Date | null;
};
export type ReviewAction = { type: 'shown' | 'click' | 'snooze' } | { type: 'rate'; rating: number } | { type: 'feedback'; text: string };
type ReviewChange = Partial<ReviewSnapshot> & { feedbackStatus?: 'OPEN' };
export const ACTIVE_REVIEW_STATES: ReviewState[] = ['PENDING', 'ELIGIBLE', 'SHOWN', 'RATED', 'DISMISSED'];

const invalid = (message: string): never => { throw new DomainError(message, 'REVIEW_INVALID'); };

export function reviewTransition(
  request: ReviewSnapshot,
  action: ReviewAction,
  config: { maxSnoozes: number; snoozeHours: number },
  now: Date,
): ReviewChange {
  const final = !ACTIVE_REVIEW_STATES.includes(request.status);
  if (action.type === 'rate' && (!Number.isInteger(action.rating) || action.rating < 1 || action.rating > 5)) {
    return invalid('La valoración debe estar entre 1 y 5.');
  }
  if (action.type === 'feedback') {
    const text = action.text.trim();
    if (text.length < 3 || text.length > 2000) return invalid('El comentario debe tener entre 3 y 2000 caracteres.');
    if (request.status === 'COMPLETED' && request.privateFeedback === text) return {};
  }
  if (final) {
    if (action.type === 'shown' || action.type === 'snooze' || (action.type === 'click' && request.clickedAt)) return {};
    // A private comment does not prevent the customer from also opening Google.
    if (action.type === 'click' && request.status === 'COMPLETED' && request.rating) return { clickedAt: now };
    throw new DomainError('La solicitud ya está finalizada.', 'REVIEW_FINALIZED');
  }
  if (request.eligibleAt > now) {
    if (action.type === 'snooze' && request.status === 'DISMISSED') return {};
    throw new DomainError('La solicitud todavía no está disponible.', 'REVIEW_NOT_ELIGIBLE');
  }
  switch (action.type) {
    case 'shown':
      return { shownAt: request.shownAt ?? now, status: request.rating ? 'RATED' : 'SHOWN' };
    case 'rate':
      return { rating: action.rating, ratedAt: request.ratedAt ?? now, shownAt: request.shownAt ?? now, status: 'RATED' };
    case 'feedback':
      if (!request.rating) return invalid('Valora tu visita antes de enviar un comentario.');
      return { privateFeedback: action.text.trim(), feedbackStatus: 'OPEN', status: 'COMPLETED', completedAt: now };
    case 'click':
      if (!request.rating) return invalid('Valora tu visita antes de continuar.');
      return { status: 'CLICKED', clickedAt: now, completedAt: now };
    case 'snooze':
      if (request.status === 'DISMISSED') return {};
      if (request.snoozeCount >= config.maxSnoozes) return { status: 'EXPIRED', completedAt: now };
      return { status: 'DISMISSED', snoozeCount: request.snoozeCount + 1, eligibleAt: new Date(now.getTime() + config.snoozeHours * 3_600_000) };
  }
}
