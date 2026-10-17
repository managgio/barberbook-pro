import React, { useState } from 'react';
import { Download, FileText, Loader2, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { issueAppointmentInvoice } from '@/data/api/invoices';
import { useTenant } from '@/context/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/hooks/useI18n';
import {
  downloadInvoicePdf,
  generateAppointmentInvoicePdf,
  shareInvoicePdf,
} from '@/lib/invoicePdf';
import { cn } from '@/lib/utils';

type AppointmentInvoiceActionsProps = {
  appointmentId: string;
  compact?: boolean;
  className?: string;
};

const AppointmentInvoiceActions: React.FC<AppointmentInvoiceActionsProps> = ({
  appointmentId,
  compact = false,
  className,
}) => {
  const { tenant } = useTenant();
  const { toast } = useToast();
  const { t, language } = useI18n();
  const [isBusy, setIsBusy] = useState(false);

  if (tenant?.config?.invoicing?.enabled !== true) return null;

  const preparePdf = async () => {
    const invoice = await issueAppointmentInvoice(appointmentId);
    return {
      invoice,
      result: await generateAppointmentInvoicePdf(invoice, language),
    };
  };

  const run = async (action: 'download' | 'share') => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      const { invoice, result } = await preparePdf();
      if (action === 'share') {
        const outcome = await shareInvoicePdf(result, t('admin.invoices.shareTitle', { number: invoice.number }));
        toast({
          title: outcome === 'shared'
            ? t('admin.invoices.toast.sharedTitle')
            : t('admin.invoices.toast.downloadedTitle'),
          description: outcome === 'shared'
            ? t('admin.invoices.toast.sharedDescription')
            : t('admin.invoices.toast.shareFallbackDescription'),
        });
      } else {
        downloadInvoicePdf(result);
        toast({
          title: t('admin.invoices.toast.downloadedTitle'),
          description: t('admin.invoices.toast.downloadedDescription', { number: invoice.number }),
        });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      toast({
        title: t('admin.invoices.toast.errorTitle'),
        description: error instanceof Error ? error.message : t('admin.invoices.toast.errorDescription'),
        variant: 'destructive',
      });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={compact ? 'icon' : 'default'}
          className={cn(compact && 'h-9 w-9', className)}
          disabled={isBusy}
          aria-label={t('admin.invoices.action')}
          title={t('admin.invoices.action')}
        >
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          {!compact && <span className="ml-2">{t('admin.invoices.action')}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => void run('download')}>
          <Download className="mr-2 h-4 w-4" />
          {t('admin.invoices.download')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void run('share')}>
          <Share2 className="mr-2 h-4 w-4" />
          {t('admin.invoices.share')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default AppointmentInvoiceActions;
