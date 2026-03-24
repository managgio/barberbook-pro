import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bot,
  Send,
  Mic,
  Square,
  Volume2,
  Sparkles,
  Wand2,
  ArrowLeft,
  BookOpen,
} from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/common/Skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useAdminPermissions } from '@/context/AdminPermissionsContext';
import {
  getAiAssistantLatestSession,
  getAiAssistantSession,
  postAiAssistantChat,
  postAiAssistantTranscribe,
} from '@/data/api/ai';
import { AiChatResponse } from '@/data/types';
import { isApiRequestError } from '@/lib/networkErrors';
import { cn } from '@/lib/utils';
import { dispatchAlertsUpdated, dispatchAppointmentsUpdated, dispatchHolidaysUpdated } from '@/lib/adminEvents';
import { useBusinessCopy } from '@/lib/businessCopy';
import { useTenant } from '@/context/TenantContext';
import { useI18n } from '@/hooks/useI18n';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
}

type SpeechRecognitionAlternativeLike = {
  transcript?: string;
};

type SpeechRecognitionResultLike = ArrayLike<SpeechRecognitionAlternativeLike>;

type SpeechRecognitionEventLike = {
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type BrowserSpeechWindow = Window & {
  SpeechRecognition?: BrowserSpeechRecognitionConstructor;
  webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
};

const LEGACY_STORAGE_KEY = 'ai-assistant-session-id';
const STORAGE_KEY_PREFIX = 'ai-assistant-session-id';
const AdminAiAssistant: React.FC = () => {
  const { user } = useAuth();
  const { currentLocationId } = useTenant();
  const { toast } = useToast();
  const copy = useBusinessCopy();
  const { t, language } = useI18n();
  const { canAccessSection } = useAdminPermissions();
  const canCreateAlerts = canAccessSection('alerts');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [activeView, setActiveView] = useState<'chat' | 'guide'>('chat');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const loadedSessionRef = useRef<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const autoSendRef = useRef(false);
  const stopInProgressRef = useRef(false);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const supportsAudio = typeof window !== 'undefined'
    && 'MediaRecorder' in window
    && 'mediaDevices' in navigator
    && typeof navigator.mediaDevices?.getUserMedia === 'function';
  const supportsSpeech = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const supportsVoiceCommand = typeof window !== 'undefined'
    && Boolean((window as BrowserSpeechWindow).SpeechRecognition || (window as BrowserSpeechWindow).webkitSpeechRecognition);
  const staffSingularLabel = copy.staff.isCollective
    ? t('admin.aiAssistant.copy.staffSingularCollective')
    : copy.staff.singularLower;
  const staffPluralLabel = copy.staff.isCollective
    ? t('admin.aiAssistant.copy.staffPluralCollective')
    : copy.staff.pluralLower;
  const staffNameExample = copy.staff.isCollective
    ? t('admin.aiAssistant.copy.staffNameExampleCollective', { name: 'Juan' })
    : t('admin.aiAssistant.copy.staffNameExample', { staffSingularLower: copy.staff.singularLower, name: 'Juan' });
  const staffNameExampleAlt = copy.staff.isCollective
    ? t('admin.aiAssistant.copy.staffNameExampleCollective', { name: 'Alejandro' })
    : t('admin.aiAssistant.copy.staffNameExample', { staffSingularLower: copy.staff.singularLower, name: 'Alejandro' });
  const staffHolidayPlaceholder = copy.staff.isCollective
    ? t('admin.aiAssistant.copy.staffOrLocationCollective', { locationSingularLower: copy.location.singularLower })
    : t('admin.aiAssistant.copy.staffOrLocation', {
      staffSingularLower: copy.staff.singularLower,
      locationSingularLower: copy.location.singularLower,
    });
  const sendCommands = language.startsWith('en') ? ['send', 'enviar'] : ['enviar', 'send'];
  const primarySendCommand = sendCommands[0];
  const scopedLocationKey = `${STORAGE_KEY_PREFIX}:${currentLocationId || 'default'}`;
  const storageKey = `${scopedLocationKey}:${user?.id || 'anonymous'}`;

  const getSupportedMimeType = () => {
    if (typeof MediaRecorder === 'undefined') return '';
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/mpeg',
    ];
    return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
  };

  const getFileExtension = (mimeType: string) => {
    if (mimeType.includes('mp4')) return 'mp4';
    if (mimeType.includes('mpeg')) return 'mp3';
    return 'webm';
  };

  const normalizeCommandText = (text: string) =>
    text.trim().toLowerCase().replace(/[.,!?;:]+/g, ' ');

  const shouldAutoSend = (text: string) => {
    const normalized = normalizeCommandText(text);
    if (!normalized) return false;
    const parts = normalized.split(/\s+/);
    return sendCommands.includes(parts[parts.length - 1]);
  };

  const stripSendCommand = (text: string) =>
    text.replace(new RegExp(`(?:\\s|^)(${sendCommands.join('|')})[\\s.,!?;:]*$`, 'i'), '').trim();

  const stopVoiceCommandListener = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    try {
      recognition.stop();
    } catch {
      // Ignore stop errors for unsupported implementations.
    }
    recognitionRef.current = null;
  }, []);

  const startVoiceCommandListener = () => {
    if (!supportsVoiceCommand) return;
    stopVoiceCommandListener();
    const speechWindow = window as BrowserSpeechWindow;
    const SpeechRecognitionConstructor =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognitionConstructor) return;
    const recognition = new SpeechRecognitionConstructor();
    recognition.lang = language.startsWith('en') ? 'en-US' : 'es-ES';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const results = event.results;
      if (!results || results.length === 0) return;
      const lastResult = results[results.length - 1];
      const transcript = lastResult?.[0]?.transcript ?? '';
      if (!shouldAutoSend(transcript)) return;
      if (autoSendRef.current || stopInProgressRef.current) return;
      autoSendRef.current = true;
      stopVoiceCommandListener();
      void stopRecording();
    };
    recognition.onerror = () => {
      stopVoiceCommandListener();
    };
    recognition.onend = () => {
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const persistSession = useCallback((newSessionId: string) => {
    setSessionId(newSessionId);
    localStorage.setItem(storageKey, newSessionId);
    localStorage.removeItem(scopedLocationKey);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }, [scopedLocationKey, storageKey]);

  const clearPersistedSession = useCallback(() => {
    setSessionId(null);
    setMessages([]);
    loadedSessionRef.current = null;
    localStorage.removeItem(storageKey);
    localStorage.removeItem(scopedLocationKey);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }, [scopedLocationKey, storageKey]);

  useEffect(() => {
    loadedSessionRef.current = null;
    setMessages([]);

    const scopedSessionId = localStorage.getItem(storageKey);
    if (scopedSessionId) {
      setSessionId(scopedSessionId);
      return;
    }

    const legacyScopedSessionId = localStorage.getItem(scopedLocationKey);
    if (legacyScopedSessionId) {
      persistSession(legacyScopedSessionId);
      return;
    }

    const legacySessionId = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacySessionId) {
      persistSession(legacySessionId);
      return;
    }

    setSessionId(null);
  }, [persistSession, scopedLocationKey, storageKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending, isRecording, isTranscribing]);

  useEffect(() => {
    let active = true;
    const loadLatestSession = async () => {
      if (!user || !currentLocationId || sessionId) return;
      setIsLoadingHistory(true);
      try {
        const latestSession = await getAiAssistantLatestSession();
        if (!active || !latestSession) return;
        loadedSessionRef.current = latestSession.sessionId;
        persistSession(latestSession.sessionId);
        setMessages(latestSession.messages.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          createdAt: message.createdAt,
        })));
      } catch (error) {
        if (!active) return;
        if (isApiRequestError(error) && error.status === 404) {
          return;
        }
        toast({
          title: t('admin.aiAssistant.toast.historyUnavailableTitle'),
          description: t('admin.aiAssistant.toast.latestHistoryUnavailableDescription'),
          variant: 'destructive',
        });
      } finally {
        if (active) {
          setIsLoadingHistory(false);
        }
      }
    };
    void loadLatestSession();
    return () => {
      active = false;
    };
  }, [currentLocationId, persistSession, sessionId, t, toast, user]);

  useEffect(() => {
    const loadSession = async () => {
      if (!user || !sessionId) return;
      if (loadedSessionRef.current === sessionId) return;
      loadedSessionRef.current = sessionId;
      setIsLoadingHistory(true);
      try {
        const session = await getAiAssistantSession({ sessionId });
        if (!session) {
          clearPersistedSession();
          return;
        }
        setMessages(session.messages.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          createdAt: message.createdAt,
        })));
      } catch (error) {
        if (isApiRequestError(error) && error.status === 404) {
          clearPersistedSession();
          return;
        }
        if (isApiRequestError(error) && error.status >= 500) {
          clearPersistedSession();
          toast({
            title: t('admin.aiAssistant.toast.historyResetTitle'),
            description: t('admin.aiAssistant.toast.historyResetDescription'),
            variant: 'destructive',
          });
          return;
        }
        toast({
          title: t('admin.aiAssistant.toast.historyUnavailableTitle'),
          description: t('admin.aiAssistant.toast.previousHistoryUnavailableDescription'),
          variant: 'destructive',
        });
        loadedSessionRef.current = null;
      } finally {
        setIsLoadingHistory(false);
      }
    };
    loadSession();
  }, [clearPersistedSession, sessionId, t, toast, user]);

  const handleResponse = (response: AiChatResponse) => {
    if (response.sessionId && response.sessionId !== sessionId) {
      persistSession(response.sessionId);
    }
    setMessages((prev) => [
      ...prev,
      {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.assistantMessage,
      },
    ]);
    if (response.actions?.appointmentsChanged) {
      dispatchAppointmentsUpdated({ source: 'ai-assistant' });
    }
    if (response.actions?.holidaysChanged) {
      dispatchHolidaysUpdated({ source: 'ai-assistant' });
    }
    if (response.actions?.alertsChanged) {
      if (!canCreateAlerts) return;
      dispatchAlertsUpdated({ source: 'ai-assistant' });
    }
  };

  const sendMessage = async (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed || !user) return;
    const hasAdminAccess = Boolean(
      user.isSuperAdmin || user.isPlatformAdmin || user.isLocalAdmin || user.role === 'admin',
    );
    if (!hasAdminAccess) {
      toast({
        title: t('admin.aiAssistant.toast.restrictedTitle'),
        description: t('admin.aiAssistant.toast.restrictedDescription'),
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);
    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: 'user', content: trimmed },
    ]);
    setInput('');

    try {
      const response = await postAiAssistantChat({
        message: trimmed,
        sessionId,
      });
      handleResponse(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('admin.aiAssistant.toast.requestErrorDefault');
      toast({
        title: t('admin.aiAssistant.toast.assistantErrorTitle'),
        description: errorMessage,
        variant: 'destructive',
      });
      if (/l[ií]mite diario/i.test(errorMessage)) {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: errorMessage,
          },
        ]);
      }
    } finally {
      setIsSending(false);
    }
  };

  const stopSpeaking = useCallback(() => {
    if (!supportsSpeech) return;
    window.speechSynthesis.cancel();
    setSpeakingMessageId(null);
  }, [supportsSpeech]);

  const speakMessage = (text: string, messageId: string) => {
    if (!supportsSpeech) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language.startsWith('en') ? 'en-US' : 'es-ES';
    utterance.onend = () => {
      setSpeakingMessageId((current) => (current === messageId ? null : current));
    };
    utterance.onerror = () => {
      setSpeakingMessageId(null);
    };
    stopSpeaking();
    setSpeakingMessageId(messageId);
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    return () => {
      stopSpeaking();
      stopVoiceCommandListener();
    };
  }, [stopSpeaking, stopVoiceCommandListener]);

  const stopRecording = async () => {
    const recorder = recorderRef.current;
    if (!recorder || stopInProgressRef.current) return;
    stopInProgressRef.current = true;
    const autoSendRequested = autoSendRef.current;
    autoSendRef.current = false;
    stopVoiceCommandListener();
    setIsRecording(false);
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      const blob = await new Promise<Blob>((resolve) => {
        const finalize = () => {
          recorder.removeEventListener('stop', finalize);
          resolve(new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' }));
        };
        recorder.addEventListener('stop', finalize);
        if (recorder.state === 'recording') {
          try {
            recorder.requestData();
          } catch {
            // Ignore requestData errors for unsupported implementations.
          }
          recorder.stop();
        } else {
          finalize();
        }
      });
      chunksRef.current = [];
      if (blob.size === 0) {
        toast({
          title: t('admin.aiAssistant.toast.emptyAudioTitle'),
          description: t('admin.aiAssistant.toast.emptyAudioDescription'),
          variant: 'destructive',
        });
        return;
      }

      if (!user) return;
      setIsTranscribing(true);
      const extension = getFileExtension(blob.type);
      const file = new File([blob], `audio-${Date.now()}.${extension}`, { type: blob.type });
      const response = await postAiAssistantTranscribe({ file });
      if (!response.text.trim()) {
        toast({
          title: t('admin.aiAssistant.toast.noTextTitle'),
          description: t('admin.aiAssistant.toast.noTextDescription'),
        });
        return;
      }
      const cleaned = response.text.trim();
      if (!cleaned.trim()) {
        toast({
          title: t('admin.aiAssistant.toast.noTextTitle'),
          description: t('admin.aiAssistant.toast.noUsefulTextDescription'),
        });
        return;
      }
      const wantsAutoSend = autoSendRequested || shouldAutoSend(cleaned);
      const payload = wantsAutoSend ? stripSendCommand(cleaned) : cleaned;
      if (!payload.trim()) {
        toast({
          title: t('admin.aiAssistant.toast.noMessageTitle'),
          description: t('admin.aiAssistant.toast.noMessageBeforeSend', { command: primarySendCommand }),
        });
        return;
      }
      if (wantsAutoSend) {
        await sendMessage(payload);
        return;
      }
      setInput((prev) => (prev.trim() ? `${prev}\n${payload}` : payload));
      inputRef.current?.focus();
    } catch (error) {
      toast({
        title: t('admin.aiAssistant.toast.transcribeErrorTitle'),
        description: error instanceof Error ? error.message : t('admin.aiAssistant.toast.transcribeErrorDescription'),
        variant: 'destructive',
      });
    } finally {
      setIsTranscribing(false);
      stopInProgressRef.current = false;
    }
  };

  const startRecording = async () => {
    if (!supportsAudio) {
      toast({
        title: t('admin.aiAssistant.toast.audioUnavailableTitle'),
        description: t('admin.aiAssistant.toast.audioUnavailableDescription'),
      });
      return;
    }
    if (isRecording) {
      await stopRecording();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      autoSendRef.current = false;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
      };
      recorder.start(1000);
      recorderRef.current = recorder;
      setRecordingSeconds(0);
      setIsRecording(true);
      startVoiceCommandListener();
      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      toast({
        title: t('admin.aiAssistant.toast.micDeniedTitle'),
        description: t('admin.aiAssistant.toast.micDeniedDescription'),
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = () => {
    if (isSending) return;
    sendMessage(input);
  };

  const applyTemplate = (template: string) => {
    setInput(template);
    inputRef.current?.focus();
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="admin-ai-assistant flex h-full min-h-0 flex-col gap-3 sm:gap-4 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <CardTitle>{t('admin.aiAssistant.title')}</CardTitle>
            <p className="text-sm text-muted-foreground">{t('admin.aiAssistant.subtitle')}</p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full rounded-full sm:w-auto"
          onClick={() => setActiveView('guide')}
          disabled={activeView === 'guide'}
        >
          <BookOpen className="h-4 w-4 mr-2" />
          {t('admin.aiAssistant.actions.quickGuide')}
        </Button>
      </div>

      {activeView === 'guide' ? (
        <Card
          variant="glass"
          className="flex flex-1 min-h-0 flex-col overflow-hidden border-primary/10 bg-gradient-to-br from-primary/5 via-card to-card"
        >
          <CardHeader className="pb-3">
            <div className="space-y-2">
              <div className="flex items-start">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="admin-ai-assistant-guide-back h-8 w-8 self-start"
                  onClick={() => setActiveView('chat')}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </div>
              <div>
                <CardTitle className="text-lg">{t('admin.aiAssistant.guide.title')}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {t('admin.aiAssistant.guide.subtitle')}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-3">
              <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs text-foreground">
                {t('admin.aiAssistant.guide.chips.newAppointments')}
              </span>
              <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs text-foreground">
                {t('admin.aiAssistant.guide.chips.holidays', {
                  locationSingularLower: copy.location.singularLower,
                  staffPluralLabel,
                })}
              </span>
              {canCreateAlerts && (
                <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs text-foreground">
                  {t('admin.aiAssistant.guide.chips.alerts')}
                </span>
              )}
              <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs text-foreground">
                {t('admin.aiAssistant.guide.chips.audio')}
              </span>
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 overflow-y-auto pt-0 pr-1">
            <Accordion
              type="single"
              collapsible
              defaultValue="citas"
              className="rounded-xl border border-border/60 bg-card/40 px-4"
            >
              <AccordionItem value="citas" className="border-border/60">
                <AccordionTrigger className="text-sm">{t('admin.aiAssistant.guide.appointments.title')}</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {t('admin.aiAssistant.guide.appointments.description', { staffSingularLabel })}
                    </p>
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                        {t('admin.aiAssistant.guide.appointments.example1', { staffNameExample })}
                      </div>
                      <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                        {t('admin.aiAssistant.guide.appointments.example2')}
                      </div>
                      <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                        {t('admin.aiAssistant.guide.appointments.example3', { staffNameExampleAlt })}
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="festivos" className="border-border/60">
                <AccordionTrigger className="text-sm">
                  {t('admin.aiAssistant.guide.holidays.title', {
                    locationSingularLower: copy.location.singularLower,
                    staffPluralLabel,
                  })}
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {t('admin.aiAssistant.guide.holidays.description', {
                        locationDefiniteSingular: copy.location.definiteSingular,
                        staffPluralLabel,
                        locationSingularLower: copy.location.singularLower,
                      })}
                    </p>
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                        {t('admin.aiAssistant.guide.holidays.example1', { locationDefiniteSingular: copy.location.definiteSingular })}
                      </div>
                      <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                        {t('admin.aiAssistant.guide.holidays.example2')}
                      </div>
                      <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                        {t('admin.aiAssistant.guide.holidays.example3', { locationDefiniteSingular: copy.location.definiteSingular })}
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
              {canCreateAlerts && (
                <AccordionItem value="alertas" className="border-border/60">
                  <AccordionTrigger className="text-sm">{t('admin.aiAssistant.guide.alerts.title')}</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        {t('admin.aiAssistant.guide.alerts.description')}
                      </p>
                      <div className="space-y-2 text-xs text-muted-foreground">
                        <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                          {t('admin.aiAssistant.guide.alerts.example1')}
                        </div>
                        <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                          {t('admin.aiAssistant.guide.alerts.example2', { locationFromWithDefinite: copy.location.fromWithDefinite })}
                        </div>
                        <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                          {t('admin.aiAssistant.guide.alerts.example3')}
                        </div>
                        <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                          {t('admin.aiAssistant.guide.alerts.example4')}
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}
              <AccordionItem value="audio" className="border-border/60">
                <AccordionTrigger className="text-sm">{t('admin.aiAssistant.guide.audio.title')}</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {t('admin.aiAssistant.guide.audio.description', { command: primarySendCommand })}
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1">
                        {t('admin.aiAssistant.guide.audio.chip1')}
                      </span>
                      <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1">
                        {t('admin.aiAssistant.guide.audio.chip2')}
                      </span>
                      <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1">
                        {t('admin.aiAssistant.guide.audio.chip3')}
                      </span>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      ) : (
        <Card variant="elevated" className="flex flex-1 flex-col min-h-0 overflow-hidden">
          <CardContent className="flex-1 min-h-0 overflow-y-auto space-y-4 py-4 sm:py-6">
          {isLoadingHistory && messages.length === 0 ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-2/3" />
              <Skeleton className="h-10 w-1/2" />
              <Skeleton className="h-10 w-3/4" />
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
              <Bot className="w-10 h-10 mb-3" />
              <p className="text-sm">{t('admin.aiAssistant.empty')}</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'max-w-[90%] sm:max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm',
                  msg.role === 'user'
                    ? 'ml-auto bg-primary text-primary-foreground'
                    : 'bg-secondary text-foreground'
                )}
              >
                <p className="whitespace-pre-line">{msg.content}</p>
                {msg.role === 'assistant' && supportsSpeech && (
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-60"
                      onClick={() => speakMessage(msg.content, msg.id)}
                      disabled={speakingMessageId === msg.id}
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      {t('admin.aiAssistant.actions.listen')}
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-60"
                      onClick={stopSpeaking}
                      disabled={!speakingMessageId}
                    >
                      <Square className="w-3.5 h-3.5" />
                      {t('admin.aiAssistant.actions.stop')}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
          {isSending && (
            <div className="max-w-[70%] rounded-2xl px-4 py-3 bg-secondary text-foreground text-sm">
              {t('admin.aiAssistant.status.thinking')}
            </div>
          )}
          {isTranscribing && (
            <div className="max-w-[70%] rounded-2xl px-4 py-3 bg-secondary text-foreground text-sm">
              {t('admin.aiAssistant.status.transcribing')}
            </div>
          )}
          <div ref={bottomRef} />
          </CardContent>
          <div className="border-t border-border p-3 sm:p-4 space-y-3">
            <div className="admin-ai-assistant-quick-actions flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full text-xs sm:text-sm whitespace-nowrap !w-auto"
                onClick={() =>
                  applyTemplate(t('admin.aiAssistant.templates.appointment', { staffSingularLabel }))
                }
                disabled={isSending || isTranscribing || isRecording}
              >
                {t('admin.aiAssistant.actions.createAppointment')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full text-xs sm:text-sm whitespace-nowrap !w-auto"
                onClick={() =>
                  applyTemplate(t('admin.aiAssistant.templates.holiday', { staffHolidayPlaceholder }))
                }
                disabled={isSending || isTranscribing || isRecording}
              >
                {t('admin.aiAssistant.actions.createHoliday')}
              </Button>
              {canCreateAlerts && (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full text-xs sm:text-sm whitespace-nowrap !w-auto"
                  onClick={() =>
                    applyTemplate(t('admin.aiAssistant.templates.alert'))
                  }
                  disabled={isSending || isTranscribing || isRecording}
                >
                  {t('admin.aiAssistant.actions.createAlert')}
                </Button>
              )}
            </div>
            <div className="admin-ai-assistant-composer space-y-2 sm:flex sm:items-end sm:gap-3 sm:space-y-0">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('admin.aiAssistant.composer.placeholder')}
                className="min-h-[48px] w-full resize-none sm:flex-1"
                disabled={isRecording}
              />
              <div className="admin-ai-assistant-composer-actions flex items-center gap-2 sm:gap-3">
                <Button
                  type="button"
                  variant={isRecording ? 'destructive' : 'outline'}
                  size="icon"
                  className="h-10 flex-1 sm:h-12 sm:w-12 sm:flex-none"
                  onClick={startRecording}
                  disabled={!supportsAudio || isSending || isTranscribing}
                  aria-pressed={isRecording}
                  aria-label={
                    isRecording
                      ? t('admin.aiAssistant.aria.stopRecording')
                      : t('admin.aiAssistant.aria.startRecording')
                  }
                >
                  {isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isSending || isRecording || isTranscribing || !input.trim()}
                  className="h-10 flex-1 px-3 sm:h-12 sm:w-12 sm:flex-none sm:px-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {isRecording
                  ? t('admin.aiAssistant.status.recording', { seconds: Math.min(recordingSeconds, 599) })
                  : ' '}
              </span>
              {isRecording && (
                <button
                  type="button"
                  className="text-xs text-foreground underline"
                  onClick={stopRecording}
                >
                  {t('admin.aiAssistant.actions.stop')}
                </button>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default AdminAiAssistant;
