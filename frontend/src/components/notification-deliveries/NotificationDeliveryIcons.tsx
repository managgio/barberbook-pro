import { AlertTriangle, Clock3, Loader2, Mail, MessageSquareText, MessagesSquare, RefreshCcw, XCircle } from 'lucide-react';

import type { NotificationDeliveryChannel, NotificationDeliveryStatus } from '@/data/api/notificationDeliveries';

export const ChannelIcon = ({ channel, className = 'h-4 w-4' }: { channel: NotificationDeliveryChannel; className?: string }) => {
  if (channel === 'sms') return <MessageSquareText className={className} />;
  if (channel === 'whatsapp') return <MessagesSquare className={className} />;
  return <Mail className={className} />;
};

export const StatusIcon = ({ status }: { status: NotificationDeliveryStatus }) => {
  if (status === 'failed') return <XCircle className="h-4 w-4 text-destructive" />;
  if (status === 'retrying') return <RefreshCcw className="h-4 w-4 text-amber-600" />;
  if (status === 'processing') return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
  if (status === 'skipped') return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
  return <Clock3 className="h-4 w-4 text-blue-600" />;
};
