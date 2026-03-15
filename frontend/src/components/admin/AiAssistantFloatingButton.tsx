import React, { lazy, Suspense, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useI18n } from '@/hooks/useI18n';

const AdminAiAssistant = lazy(() => import('@/pages/admin/AdminAiAssistant'));

const AiAssistantFloatingButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useI18n();

  return (
    <>
      <Button
        className="fixed bottom-24 right-6 h-12 w-12 rounded-full shadow-lg z-50"
        variant="secondary"
        size="icon"
        onClick={() => setIsOpen(true)}
        aria-label={t('admin.aiAssistant.fab.openAria')}
      >
        <Sparkles className="w-5 h-5" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="admin-ai-assistant-modal max-w-5xl h-[88vh] max-h-[92vh] p-3 sm:h-[80vh] sm:max-h-[85vh] sm:p-6 flex flex-col overflow-hidden">
          <DialogTitle className="sr-only">{t('admin.aiAssistant.title')}</DialogTitle>
          <DialogDescription className="sr-only">
            {t('admin.aiAssistant.fab.description')}
          </DialogDescription>
          <div className="flex-1 min-h-0">
            <Suspense
              fallback={(
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              )}
            >
              {isOpen ? <AdminAiAssistant /> : null}
            </Suspense>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AiAssistantFloatingButton;
