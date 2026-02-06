import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Star } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  clickReview,
  getPendingReview,
  markReviewShown,
  rateReview,
  sendReviewFeedback,
  snoozeReview,
} from '@/data/api/reviews';
import { ReviewPendingResponse } from '@/data/types';
import { cn } from '@/lib/utils';

const allowedPaths = ['/app', '/app/appointments', '/app/profile'];

const ReviewPromptModal: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const [request, setRequest] = useState<ReviewPendingResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'rating' | 'positive' | 'negative'>('rating');
  const [rating, setRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const completedRef = useRef(false);
  const shownRef = useRef(false);

  const shouldCheck = useMemo(() => {
    return allowedPaths.some((path) => location.pathname === path || location.pathname.startsWith(`${path}/`));
  }, [location.pathname]);

  const resetState = useCallback(() => {
    setStep('rating');
    setRating(null);
    setFeedback('');
    setOpen(false);
    setRequest(null);
    completedRef.current = false;
    shownRef.current = false;
  }, []);

  const loadPending = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await getPendingReview({ userId: user.id });
      if (data && data.id) {
        setRequest(data);
        setOpen(true);
        return;
      }
      setRequest(null);
      resetState();
    } catch (error) {
      setRequest(null);
    }
  }, [resetState, user?.id]);

  useEffect(() => {
    if (!user?.id || !shouldCheck) return;
    loadPending();
  }, [loadPending, shouldCheck, user?.id]);

  useEffect(() => {
    if (!open || !request || shownRef.current) return;
    shownRef.current = true;
    markReviewShown(request.id, { userId: user?.id })
      .catch(() => {
        shownRef.current = false;
      });
  }, [open, request, user?.id]);

  const handleClose = useCallback(async () => {
    if (!request || completedRef.current) {
      resetState();
      return;
    }
    try {
      await snoozeReview(request.id, { userId: user?.id });
    } catch {
      // ignore
    } finally {
      resetState();
    }
  }, [request, resetState, user?.id]);

  const handleRate = async (value: number) => {
    if (!request || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const response = await rateReview(request.id, { rating: value, userId: user?.id });
      setRating(value);
      if (response.next === 'GOOGLE') {
        setStep('positive');
      } else {
        setStep('negative');
      }
    } catch (error) {
      toast({
        title: 'No se pudo guardar',
        description: error instanceof Error ? error.message : 'Inténtalo más tarde.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePositiveClick = async () => {
    if (!request || !request.googleReviewUrl) return;
    completedRef.current = true;
    window.open(request.googleReviewUrl, '_blank', 'noopener');
    try {
      await clickReview(request.id, { userId: user?.id });
    } catch {
      // ignore
    } finally {
      resetState();
    }
  };

  const handleFeedback = async () => {
    if (!request || isSubmitting) return;
    if (!feedback.trim()) {
      toast({
        title: 'Escribe un comentario',
        description: 'Necesitamos un poco más de detalle para ayudarte.',
      });
      return;
    }
    setIsSubmitting(true);
    try {
      await sendReviewFeedback(request.id, { text: feedback.trim(), userId: user?.id });
      completedRef.current = true;
      resetState();
      toast({
        title: 'Gracias por tu feedback',
        description: 'Tu comentario ya está en manos del equipo.',
      });
    } catch (error) {
      toast({
        title: 'No se pudo enviar',
        description: error instanceof Error ? error.message : 'Inténtalo más tarde.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!request) return null;

  const copy = request.copy;

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : handleClose())}>
      <DialogContent className="sm:max-w-md gap-6 rounded-2xl border border-border/60 bg-background/95 p-6 shadow-xl backdrop-blur">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-xl font-semibold text-foreground">{copy.title}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {copy.subtitle}
          </DialogDescription>
        </DialogHeader>

        {step === 'rating' && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2">
              {Array.from({ length: 5 }).map((_, index) => {
                const value = index + 1;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleRate(value)}
                    disabled={isSubmitting}
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-full border border-border/60 transition-all',
                      rating && value <= rating ? 'bg-primary text-primary-foreground' : 'bg-muted/30 text-muted-foreground',
                    )}
                  >
                    <Star className="h-5 w-5" />
                  </button>
                );
              })}
            </div>
            <p className="text-center text-xs text-muted-foreground">Toca una estrella para valorar tu visita.</p>
          </div>
        )}

        {step === 'positive' && (
          <div className="space-y-4">
            <p className="text-sm text-foreground/90">{copy.positiveText}</p>
            <Button onClick={handlePositiveClick} className="w-full">
              {copy.positiveCta}
            </Button>
          </div>
        )}

        {step === 'negative' && (
          <div className="space-y-4">
            <p className="text-sm text-foreground/90">{copy.negativeText}</p>
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Cuéntanos qué pasó"
              className="min-h-[120px]"
            />
            <Button onClick={handleFeedback} className="w-full" disabled={isSubmitting}>
              {copy.negativeCta}
            </Button>
          </div>
        )}

        <div className="flex items-center justify-center">
          <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>
            {copy.snoozeCta}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReviewPromptModal;
