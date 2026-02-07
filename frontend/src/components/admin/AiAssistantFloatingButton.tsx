import React, { lazy, Suspense, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

const AdminAiAssistant = lazy(() => import('@/pages/admin/AdminAiAssistant'));

const AiAssistantFloatingButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        className="fixed bottom-24 right-6 h-12 w-12 rounded-full shadow-lg z-50"
        variant="secondary"
        size="icon"
        onClick={() => setIsOpen(true)}
        aria-label="Abrir asistente IA"
      >
        <Sparkles className="w-5 h-5" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-5xl h-[80vh] max-h-[85vh] p-6 flex flex-col overflow-hidden">
          <DialogTitle className="sr-only">Asistente IA</DialogTitle>
          <DialogDescription className="sr-only">
            Asistente para gestionar citas, festivos y avisos del local desde el panel de administración.
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
