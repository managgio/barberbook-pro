import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Star } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/AuthContext';
import { useTenant } from '@/context/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { clickReview, getPendingReview, markReviewShown, rateReview, sendReviewFeedback, snoozeReview } from '@/data/api/reviews';
import { ReviewPendingResponse } from '@/data/types';
import { useI18n } from '@/hooks/useI18n';

const allowedPaths = ['/app', '/app/appointments', '/app/profile'];

// Remounting by actor/local/language discards responses and drafts from the previous scope.
const ReviewPromptModal: React.FC = () => {
  const { user } = useAuth();
  const { tenant, currentLocationId } = useTenant();
  const { language } = useI18n();
  const { pathname } = useLocation();
  if (!user?.id || !currentLocationId || !allowedPaths.includes(pathname) || tenant?.config?.adminSidebar?.hiddenSections?.includes('reviews')) return null;
  return <ScopedReviewPrompt key={`${currentLocationId}:${user.id}:${language}`} />;
};

const ScopedReviewPrompt: React.FC = () => {
  const { toast } = useToast();
  const { t } = useI18n();
  const [request, setRequest] = useState<ReviewPendingResponse | null>(null);
  const [feedback, setFeedback] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const busy = useRef(false);
  const shown = useRef<Promise<unknown>>(Promise.resolve());
  const active = useRef(true);

  useEffect(() => {
    let cancelled = false;
    active.current = true;
    void getPendingReview().then((data) => {
      if (cancelled || !data) return;
      setRequest(data);
      shown.current = markReviewShown(data.id).catch(() => undefined);
    }).catch(() => undefined);
    return () => { cancelled = true; active.current = false; };
  }, []);

  const execute = async (action: () => Promise<void>, errorTitle: string) => {
    if (busy.current || !active.current) return;
    busy.current = true;
    setIsSubmitting(true);
    try { await shown.current; if (active.current) await action(); } catch {
      if (active.current) toast({ title: errorTitle, description: t('reviewPrompt.toast.tryLater'), variant: 'destructive' });
    } finally {
      busy.current = false;
      if (active.current) setIsSubmitting(false);
    }
  };

  const close = () => {
    if (!request || busy.current) return;
    void execute(async () => { await snoozeReview(request.id); }, t('reviewPrompt.toast.saveErrorTitle'))
      .finally(() => { if (active.current) setRequest(null); });
  };
  const rate = (rating: number) => {
    if (!request) return;
    void execute(async () => {
      const result = await rateReview(request.id, { rating });
      setRequest({ ...request, rating, googleReviewUrl: result.googleReviewUrl || request.googleReviewUrl });
    }, t('reviewPrompt.toast.saveErrorTitle'));
  };
  const openGoogle = () => {
    if (!request || busy.current) return;
    window.open(request.googleReviewUrl, '_blank', 'noopener,noreferrer');
    void execute(async () => { await clickReview(request.id); setRequest(null); }, t('reviewPrompt.toast.saveErrorTitle'));
  };
  const submitFeedback = () => {
    if (!request) return;
    const text = feedback.trim();
    if (text.length < 3 || text.length > 2000) {
      toast({ title: t('reviewPrompt.toast.missingFeedbackTitle'), description: t('reviewPrompt.feedbackLength') });
      return;
    }
    void execute(async () => {
      await sendReviewFeedback(request.id, { text });
      setRequest(null);
      if (active.current) toast({ title: t('reviewPrompt.toast.feedbackSentTitle'), description: t('reviewPrompt.toast.feedbackSentDescription') });
    }, t('reviewPrompt.toast.sendErrorTitle'));
  };

  if (!request) return null;
  const copy = request.copy;
  return (
    <Dialog open onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent className="w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto sm:max-w-md gap-6 rounded-2xl border border-border/60 bg-background/95 p-6 shadow-xl backdrop-blur"
        onEscapeKeyDown={(event) => { if (busy.current) event.preventDefault(); }}
        onPointerDownOutside={(event) => { if (busy.current) event.preventDefault(); }}>
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-xl font-semibold text-foreground">{copy.title}</DialogTitle>
          <DialogDescription>{copy.subtitle}</DialogDescription>
        </DialogHeader>
        {!request.rating ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2">
              {Array.from({ length: 5 }, (_, index) => index + 1).map((value) => (
                <button key={value} type="button" aria-label={t('reviewPrompt.ratingLabel', { rating: value })}
                  onClick={() => rate(value)} disabled={isSubmitting}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-muted/30 text-muted-foreground transition-all hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
                  <Star className="h-5 w-5" />
                </button>
              ))}
            </div>
            <p className="text-center text-xs text-muted-foreground">{t('reviewPrompt.ratingHint')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-foreground/90">{copy.positiveText}</p>
            <Button onClick={openGoogle} disabled={isSubmitting} className="w-full">{copy.positiveCta}</Button>
            <Button variant="outline" onClick={() => setShowFeedback((value) => !value)} disabled={isSubmitting}
              aria-expanded={showFeedback} aria-controls="review-private-feedback" className="w-full">
              {t('reviewPrompt.privateFeedback')}
            </Button>
            {showFeedback && <div id="review-private-feedback" className="space-y-3">
              <p className="text-sm text-foreground/90">{copy.negativeText}</p>
              <label htmlFor="review-feedback" className="text-sm text-muted-foreground">{t('reviewPrompt.privateFeedbackHint')}</label>
              <Textarea id="review-feedback" value={feedback} onChange={(event) => setFeedback(event.target.value)}
                maxLength={2000} disabled={isSubmitting} placeholder={t('reviewPrompt.feedbackPlaceholder')} className="min-h-[120px]" />
              <p className="text-xs text-muted-foreground">{t('reviewPrompt.feedbackLength')}</p>
              <Button onClick={submitFeedback} disabled={isSubmitting} className="w-full">{copy.negativeCta}</Button>
            </div>}
          </div>
        )}
        <Button variant="ghost" onClick={close} disabled={isSubmitting}>{copy.snoozeCta}</Button>
      </DialogContent>
    </Dialog>
  );
};

export default ReviewPromptModal;
