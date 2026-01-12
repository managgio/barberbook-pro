import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Send,
  Mic,
  Square,
  Volume2,
  Sparkles,
  CalendarCheck,
  CalendarPlus,
  Headphones,
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
import { getAiAssistantSession, postAiAssistantChat, postAiAssistantTranscribe } from '@/data/api';
import { AiChatResponse } from '@/data/types';
import { cn } from '@/lib/utils';
import { dispatchAppointmentsUpdated, dispatchHolidaysUpdated } from '@/lib/adminEvents';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
}

const STORAGE_KEY = 'ai-assistant-session-id';

const AdminAiAssistant: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
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
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const supportsAudio = typeof window !== 'undefined'
    && 'MediaRecorder' in window
    && 'mediaDevices' in navigator
    && typeof navigator.mediaDevices?.getUserMedia === 'function';
  const supportsSpeech = typeof window !== 'undefined' && 'speechSynthesis' in window;

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

  useEffect(() => {
    const initialSessionId = localStorage.getItem(STORAGE_KEY);
    if (initialSessionId) {
      setSessionId(initialSessionId);
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending, isRecording, isTranscribing]);

  useEffect(() => {
    const loadSession = async () => {
      if (!user || !sessionId) return;
      if (loadedSessionRef.current === sessionId) return;
      loadedSessionRef.current = sessionId;
      setIsLoadingHistory(true);
      try {
        const session = await getAiAssistantSession({
          sessionId,
          adminUserId: user.id,
          role: user.role,
        });
        setMessages(session.messages.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          createdAt: message.createdAt,
        })));
      } catch (error) {
        loadedSessionRef.current = null;
      } finally {
        setIsLoadingHistory(false);
      }
    };
    loadSession();
  }, [sessionId, user]);

  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  const persistSession = (newSessionId: string) => {
    setSessionId(newSessionId);
    localStorage.setItem(STORAGE_KEY, newSessionId);
  };

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
  };

  const sendMessage = async (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed || !user) return;
    if (user.role !== 'admin') {
      toast({
        title: 'Acceso restringido',
        description: 'Solo los administradores pueden usar el asistente.',
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
        adminUserId: user.id,
        role: user.role,
      });
      handleResponse(response);
    } catch (error) {
      toast({
        title: 'Error del asistente',
        description: error instanceof Error ? error.message : 'No se pudo completar la solicitud.',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  const stopSpeaking = () => {
    if (!supportsSpeech) return;
    window.speechSynthesis.cancel();
    setSpeakingMessageId(null);
  };

  const speakMessage = (text: string, messageId: string) => {
    if (!supportsSpeech) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
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

  const stopRecording = async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    setIsRecording(false);
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

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
        title: 'Audio vacío',
        description: 'No se detectó audio para transcribir.',
        variant: 'destructive',
      });
      return;
    }

    if (!user) return;
    setIsTranscribing(true);
    try {
      const extension = getFileExtension(blob.type);
      const file = new File([blob], `audio-${Date.now()}.${extension}`, { type: blob.type });
      const response = await postAiAssistantTranscribe({
        file,
        adminUserId: user.id,
        role: user.role,
      });
      if (!response.text.trim()) {
        toast({
          title: 'Sin texto',
          description: 'No pude transcribir el audio. Intenta de nuevo.',
        });
        return;
      }
      await sendMessage(response.text);
    } catch (error) {
      toast({
        title: 'Error al transcribir',
        description: error instanceof Error ? error.message : 'No se pudo transcribir el audio.',
        variant: 'destructive',
      });
    } finally {
      setIsTranscribing(false);
    }
  };

  const startRecording = async () => {
    if (!supportsAudio) {
      toast({
        title: 'Audio no disponible',
        description: 'Tu navegador no soporta grabación de audio.',
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
      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      toast({
        title: 'Permiso denegado',
        description: 'No se pudo acceder al micrófono.',
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
    <div className="flex h-full min-h-0 flex-col gap-4 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <CardTitle>Asistente IA</CardTitle>
            <p className="text-sm text-muted-foreground">Citas y festivos en segundos.</p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => setActiveView('guide')}
          disabled={activeView === 'guide'}
        >
          <BookOpen className="h-4 w-4 mr-2" />
          Guia rapida
        </Button>
      </div>

      {activeView === 'guide' ? (
        <Card variant="glass" className="flex flex-1 flex-col border-primary/10 bg-gradient-to-br from-primary/5 via-card to-card">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mt-0.5"
                  onClick={() => setActiveView('chat')}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Wand2 className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">Guia rapida del asistente</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Ejemplos, variantes y funciones para sacarle todo el partido.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-3">
              <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs text-foreground">
                Citas nuevas
              </span>
              <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs text-foreground">
                Festivos local o barberos
              </span>
              <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs text-foreground">
                Audio y escucha
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <Accordion
              type="single"
              collapsible
              defaultValue="citas"
              className="rounded-xl border border-border/60 bg-card/40 px-4"
            >
              <AccordionItem value="citas" className="border-border/60">
                <AccordionTrigger className="text-sm">Citas: que pedir y como pedirlo</AccordionTrigger>
                <AccordionContent>
                  <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr] md:items-center">
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Pide citas nuevas con fecha, hora, servicio y barbero. Si falta algo, el asistente te lo pide.
                      </p>
                      <div className="space-y-2 text-xs text-muted-foreground">
                        <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                          Crea una cita para Marta el viernes a las 18:30 con barba y barbero Juan.
                        </div>
                        <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                          Reserva para Luis el 12 de enero a las 10:00 con corte clasico.
                        </div>
                      </div>
                    </div>
                    <div className="relative h-28 w-full overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-secondary/20">
                      <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-primary/10" />
                      <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-lg bg-background/80 px-3 py-2 shadow-sm">
                        <CalendarCheck className="h-4 w-4 text-primary" />
                        <span className="text-xs font-medium text-foreground">Cita confirmada</span>
                      </div>
                      <div className="absolute top-5 left-5 h-2 w-16 rounded-full bg-primary/40" />
                      <div className="absolute top-9 left-5 h-2 w-10 rounded-full bg-primary/20" />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="festivos" className="border-border/60">
                <AccordionTrigger className="text-sm">Festivos flexibles: local, barberos y rangos</AccordionTrigger>
                <AccordionContent>
                  <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr] md:items-center">
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Puedes crear festivos para el local o para uno o varios barberos. Si no dices el alcance,
                        se entiende local. Tambien puedes mezclar varios festivos en un solo mensaje.
                      </p>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1">
                          local / salon / barberia
                        </span>
                        <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1">
                          para Alejandro y Pablo
                        </span>
                        <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1">
                          y otro / ademas
                        </span>
                      </div>
                      <div className="space-y-2 text-xs text-muted-foreground">
                        <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                          Crea un festivo para el local el 13 de enero.
                        </div>
                        <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                          Festivo del 15 al 18 para Alejandro y Pablo.
                        </div>
                        <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                          Crea un festivo para el salon el 5 y otro del 8 al 10 para Ana.
                        </div>
                      </div>
                    </div>
                    <div className="relative h-28 w-full overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-secondary/30 via-card to-primary/10">
                      <div className="absolute -left-6 -bottom-6 h-20 w-20 rounded-full bg-secondary/40" />
                      <div className="absolute top-4 left-4 flex items-center gap-2 rounded-lg bg-background/80 px-3 py-2 shadow-sm">
                        <CalendarPlus className="h-4 w-4 text-primary" />
                        <span className="text-xs font-medium text-foreground">Festivo creado</span>
                      </div>
                      <div className="absolute top-14 left-4 h-2 w-20 rounded-full bg-primary/30" />
                      <div className="absolute top-[4.1rem] left-4 h-2 w-12 rounded-full bg-primary/15" />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="audio" className="border-border/60">
                <AccordionTrigger className="text-sm">Audio y escucha: manos libres</AccordionTrigger>
                <AccordionContent>
                  <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr] md:items-center">
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Pulsa el microfono para dictar. El mensaje se transcribe y se envia como texto. Ademas,
                        puedes escuchar cualquier respuesta del asistente.
                      </p>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1">
                          Dictado rapido
                        </span>
                        <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1">
                          Transcripcion automatica
                        </span>
                        <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1">
                          Escuchar respuesta
                        </span>
                      </div>
                    </div>
                    <div className="relative h-28 w-full overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-secondary/20">
                      <div className="absolute -right-6 bottom-0 h-20 w-20 rounded-full bg-primary/10" />
                      <div className="absolute top-4 left-4 flex items-center gap-2 rounded-lg bg-background/80 px-3 py-2 shadow-sm">
                        <Headphones className="h-4 w-4 text-primary" />
                        <span className="text-xs font-medium text-foreground">Escucha activa</span>
                      </div>
                      <div className="absolute bottom-5 left-4 flex items-end gap-1">
                        <div className="h-2 w-1 rounded-full bg-primary/30" />
                        <div className="h-4 w-1 rounded-full bg-primary/50" />
                        <div className="h-6 w-1 rounded-full bg-primary/70" />
                        <div className="h-3 w-1 rounded-full bg-primary/40" />
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      ) : (
        <Card variant="elevated" className="flex flex-1 flex-col min-h-0 overflow-hidden">
          <CardContent className="flex-1 min-h-0 overflow-y-auto space-y-4 py-6">
          {isLoadingHistory && messages.length === 0 ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-2/3" />
              <Skeleton className="h-10 w-1/2" />
              <Skeleton className="h-10 w-3/4" />
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
              <Bot className="w-10 h-10 mb-3" />
              <p className="text-sm">Escribe una solicitud o usa un atajo.</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm',
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
                      Escuchar
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-60"
                      onClick={stopSpeaking}
                      disabled={!speakingMessageId}
                    >
                      <Square className="w-3.5 h-3.5" />
                      Detener
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
          {isSending && (
            <div className="max-w-[70%] rounded-2xl px-4 py-3 bg-secondary text-foreground text-sm">
              Pensando...
            </div>
          )}
          {isTranscribing && (
            <div className="max-w-[70%] rounded-2xl px-4 py-3 bg-secondary text-foreground text-sm">
              Transcribiendo audio...
            </div>
          )}
          <div ref={bottomRef} />
          </CardContent>
          <div className="border-t border-border p-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() =>
                  applyTemplate('Crea una cita para [cliente] el [fecha] a las [hora] con [servicio] y [barbero].')
                }
                disabled={isSending || isTranscribing || isRecording}
              >
                Crear cita
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() =>
                  applyTemplate('Crea un festivo para [barbero o local] del [fecha inicio] al [fecha fin].')
                }
                disabled={isSending || isTranscribing || isRecording}
              >
                Crear festivo
              </Button>
            </div>
            <div className="flex gap-3 items-end">
              <Button
                type="button"
                variant={isRecording ? 'destructive' : 'outline'}
                size="icon"
                className="h-12 w-12"
                onClick={startRecording}
                disabled={!supportsAudio || isSending || isTranscribing}
                aria-pressed={isRecording}
                aria-label={isRecording ? 'Detener grabación' : 'Grabar audio'}
              >
                {isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe la cita o el festivo..."
                className="min-h-[48px] resize-none"
                disabled={isRecording}
              />
              <Button
                onClick={handleSubmit}
                disabled={isSending || isRecording || isTranscribing || !input.trim()}
                className="h-12 px-4"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {isRecording
                  ? `Grabando audio… ${Math.min(recordingSeconds, 599)}s`
                  : ' '}
              </span>
              {isRecording && (
                <button
                  type="button"
                  className="text-xs text-foreground underline"
                  onClick={stopRecording}
                >
                  Detener
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
