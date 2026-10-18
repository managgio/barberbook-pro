import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2, MessageSquareText, Send } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { sendPlatformTestSms } from '@/data/api/platform';
import { useI18n } from '@/hooks/useI18n';
import { useToast } from '@/hooks/use-toast';
import { analyzeSmsSegmentation, SMS_MAX_STANDARD_SEGMENTS } from '@/lib/smsSegmentation';
import { cn } from '@/lib/utils';

const DEFAULT_TEST_MESSAGE = 'MANAGGIO: recordatorio SMS de prueba.';

const isPlausiblePhone = (value: string) => {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+')) return /^[1-9]\d{7,14}$/.test(digits);
  if (digits.startsWith('00')) return /^[1-9]\d{7,14}$/.test(digits.slice(2));
  if (digits.startsWith('34')) return /^[1-9]\d{7,14}$/.test(digits);
  return digits.length === 9 || (digits.length === 10 && digits.startsWith('0'));
};

export default function PlatformSmsTestPanel() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState(DEFAULT_TEST_MESSAGE);
  const phoneValid = isPlausiblePhone(phone);
  const normalizedMessage = message.trim();
  const messageLength = normalizedMessage.length;
  const segmentation = analyzeSmsSegmentation(normalizedMessage);
  const messageFitsSegmentLimit = segmentation.segments <= SMS_MAX_STANDARD_SEGMENTS;

  const testMutation = useMutation({
    mutationFn: () => sendPlatformTestSms({
      phone: phone.trim(),
      ...(normalizedMessage ? { message: normalizedMessage } : {}),
    }),
    onSuccess: (result) => {
      if (result.senderMatchesExpected === false) {
        toast({
          title: t('platform.smsTest.senderMismatchTitle'),
          description: t('platform.smsTest.senderMismatchDescription', {
            expected: 'MANAGGIO',
            actual: result.actualSender || t('platform.smsTest.senderUnknown'),
          }),
          variant: 'destructive',
        });
        return;
      }
      if (result.senderMatchesExpected !== true) {
        toast({
          title: t('platform.smsTest.senderUnverifiedTitle'),
          description: t('platform.smsTest.senderUnverifiedDescription', { expected: 'MANAGGIO' }),
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: t('platform.smsTest.successTitle'),
        description: t('platform.smsTest.successDescriptionWithSender', {
          sender: result.actualSender || 'MANAGGIO',
        }),
      });
    },
    onError: () => {
      toast({
        title: t('platform.smsTest.errorTitle'),
        description: t('platform.smsTest.errorDescription'),
        variant: 'destructive',
      });
    },
  });

  return (
    <Card className="overflow-hidden border border-primary/25 bg-gradient-to-br from-card via-card to-primary/[0.06]">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <MessageSquareText className="h-4 w-4" aria-hidden="true" />
            </div>
            <CardTitle className="text-base">{t('platform.smsTest.title')}</CardTitle>
          </div>
          <Badge variant="secondary">{t('platform.smsTest.localOnly')}</Badge>
        </div>
        <p className="max-w-3xl text-xs leading-5 text-muted-foreground">
          {t('platform.smsTest.description')}
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto] lg:items-end">
        <div className="space-y-2">
          <Label htmlFor="platform-sms-test-phone">{t('platform.smsTest.phone')}</Label>
          <Input
            id="platform-sms-test-phone"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            maxLength={40}
            placeholder="+34 600 000 000"
            value={phone}
            aria-invalid={phone.length > 0 && !phoneValid}
            aria-describedby={phone.length > 0 && !phoneValid ? 'platform-sms-test-phone-error' : undefined}
            onChange={(event) => setPhone(event.target.value)}
          />
          {phone.length > 0 && !phoneValid && (
            <p id="platform-sms-test-phone-error" role="alert" className="text-xs text-destructive">
              {t('platform.smsTest.phoneInvalid')}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="platform-sms-test-message">{t('platform.smsTest.message')}</Label>
            <span className="text-[11px] tabular-nums text-muted-foreground">{messageLength}/280</span>
          </div>
          <Textarea
            id="platform-sms-test-message"
            maxLength={280}
            rows={2}
            value={message}
            className="min-h-[42px] resize-y"
            aria-invalid={!messageFitsSegmentLimit}
            aria-describedby="platform-sms-test-analysis"
            onChange={(event) => setMessage(event.target.value)}
          />
          <div id="platform-sms-test-analysis" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
            <span className="text-muted-foreground">
              {t('platform.smsTest.expectedSender', { sender: 'MANAGGIO' })}
            </span>
            <span aria-hidden="true" className="text-border">·</span>
            <span
              aria-live="polite"
              className={cn(messageFitsSegmentLimit ? 'text-muted-foreground' : 'font-medium text-destructive')}
            >
              {t('platform.smsTest.segmentation', {
                encoding: segmentation.encoding,
                segments: segmentation.segments,
                max: SMS_MAX_STANDARD_SEGMENTS,
              })}
            </span>
          </div>
          {!messageFitsSegmentLimit && (
            <p role="alert" className="text-xs text-destructive">
              {t('platform.smsTest.segmentLimitExceeded', { max: SMS_MAX_STANDARD_SEGMENTS })}
            </p>
          )}
        </div>
        <Button
          type="button"
          className="w-full lg:w-auto"
          disabled={!phoneValid || messageLength === 0 || !messageFitsSegmentLimit || testMutation.isPending}
          onClick={() => testMutation.mutate()}
        >
          {testMutation.isPending
            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            : <Send className="mr-2 h-4 w-4" aria-hidden="true" />}
          {t('platform.smsTest.send')}
        </Button>
      </CardContent>
    </Card>
  );
}
