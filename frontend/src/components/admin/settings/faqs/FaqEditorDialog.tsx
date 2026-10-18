import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import InlineTranslationPopover from '@/components/admin/InlineTranslationPopover';
import { Faq, FaqContent, FAQ_LIMITS } from '@/data/api/faqs';
import { useI18n } from '@/hooks/useI18n';

type Props = {
  faq: Faq | null;
  busy: boolean;
  onClose: () => void;
  onSave: (content: FaqContent) => Promise<void>;
  onTranslationUpdated: () => Promise<void>;
};

export default function FaqEditorDialog({ faq, busy, onClose, onSave, onTranslationUpdated }: Props) {
  const { t } = useI18n();
  const [question, setQuestion] = useState(faq?.question ?? '');
  const [answer, setAnswer] = useState(faq?.answer ?? '');
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t(faq ? 'admin.faq.edit' : 'admin.faq.add')}</DialogTitle>
          <DialogDescription>{t('admin.faq.editorHint')}</DialogDescription>
        </DialogHeader>
        <form className="space-y-5" onSubmit={(event) => {
          event.preventDefault();
          if (!busy && question.trim() && answer.trim()) void onSave({ question: question.trim(), answer: answer.trim() });
        }}>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="faq-question">{t('admin.faq.question')}</Label>
              {faq && <InlineTranslationPopover entityType="faq" entityId={faq.id} fieldKey="question" onUpdated={onTranslationUpdated} />}
            </div>
            <Input id="faq-question" autoFocus value={question} maxLength={FAQ_LIMITS.question} required disabled={busy}
              onChange={(event) => setQuestion(event.target.value)} placeholder={t('admin.faq.questionPlaceholder')} />
            <p className="text-right text-xs tabular-nums text-muted-foreground">{question.length}/{FAQ_LIMITS.question}</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="faq-answer">{t('admin.faq.answer')}</Label>
              {faq && <InlineTranslationPopover entityType="faq" entityId={faq.id} fieldKey="answer" onUpdated={onTranslationUpdated} />}
            </div>
            <Textarea id="faq-answer" value={answer} rows={8} maxLength={FAQ_LIMITS.answer} required disabled={busy}
              onChange={(event) => setAnswer(event.target.value)} placeholder={t('admin.faq.answerPlaceholder')} />
            <p className="text-right text-xs tabular-nums text-muted-foreground">{answer.length}/{FAQ_LIMITS.answer}</p>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>{t('admin.faq.cancel')}</Button>
            <Button type="submit" disabled={busy || !question.trim() || !answer.trim()}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('admin.faq.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
