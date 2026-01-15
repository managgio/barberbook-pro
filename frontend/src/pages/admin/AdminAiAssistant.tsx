import React, { useEffect, useRef, useState } from 'react';
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
import { getAiAssistantSession, postAiAssistantChat, postAiAssistantTranscribe } from '@/data/api';
import { AiChatResponse } from '@/data/types';
import { cn } from '@/lib/utils';
import { dispatchAlertsUpdated, dispatchAppointmentsUpdated, dispatchHolidaysUpdated } from '@/lib/adminEvents';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
}

const STORAGE_KEY = 'ai-assistant-session-id';
const SEND_COMMAND = 'enviar';
const AdminAiAssistant: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
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
  const recognitionRef = useRef<any>(null);
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
    && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

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
    return parts[parts.length - 1] === SEND_COMMAND;
  };

  const stripSendCommand = (text: string) =>
    text.replace(new RegExp(`(?:\\s|^)${SEND_COMMAND}[\\s.,!?;:]*$`, 'i'), '').trim();

  const stopVoiceCommandListener = () => {
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
  };

  const startVoiceCommandListener = () => {
    if (!supportsVoiceCommand) return;
    stopVoiceCommandListener();
    const SpeechRecognitionConstructor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionConstructor) return;
    const recognition = new SpeechRecognitionConstructor();
    recognition.lang = 'es-ES';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event: any) => {
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
    if (response.actions?.alertsChanged) {
      if (!canCreateAlerts) return;
      dispatchAlertsUpdated({ source: 'ai-assistant' });
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

  useEffect(() => {
    return () => {
      stopSpeaking();
      stopVoiceCommandListener();
    };
  }, []);

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
          title: 'Audio vacío',
          description: 'No se detectó audio para transcribir.',
          variant: 'destructive',
        });
        return;
      }

      if (!user) return;
      setIsTranscribing(true);
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
      const cleaned = response.text.trim();
      if (!cleaned.trim()) {
        toast({
          title: 'Sin texto',
          description: 'No se detecto texto util en el audio.',
        });
        return;
      }
      const wantsAutoSend = autoSendRequested || shouldAutoSend(cleaned);
      const payload = wantsAutoSend ? stripSendCommand(cleaned) : cleaned;
      if (!payload.trim()) {
        toast({
          title: 'Sin mensaje',
          description: 'No se detecto contenido antes de "enviar".',
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
        title: 'Error al transcribir',
        description: error instanceof Error ? error.message : 'No se pudo transcribir el audio.',
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
              {canCreateAlerts && (
                <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs text-foreground">
                  Alertas y avisos
                </span>
              )}
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
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Pide citas nuevas con fecha, hora, servicio y barbero. Si falta algo, el asistente te lo pide.
                    </p>
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                        Crea una cita para Marta Sancho el viernes a las 18:30 con servicio corte clasico y barbero Juan.
                      </div>
                      <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                        Reserva para el cliente Luis Martínez el 12 de enero a las 10:00 con corte clásico y con peluquero Alejandro.
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="festivos" className="border-border/60">
                <AccordionTrigger className="text-sm">Festivos flexibles: local, barberos y rangos</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Puedes crear festivos para el local o para uno o varios barberos. Si no dices el alcance,
                      se entiende local. Tambien puedes mezclar varios festivos en un solo mensaje.
                    </p>
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                        Crea un festivo para el local el martes que viene.
                      </div>
                      <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                        Festivo del 15 al 18 de este mes para Alejandro y Pablo.
                      </div>
                      <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                        Crea un festivo para el salon el 5 y otro del 8 al 10 de marzo para Ana.
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
              {canCreateAlerts && (
                <AccordionItem value="alertas" className="border-border/60">
                  <AccordionTrigger className="text-sm">Alertas: anuncios, avisos y novedades</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Describe el tema de la alerta y el asistente redacta el titulo y el mensaje con el tono adecuado.
                        Clasifica automaticamente si es exito, advertencia o informacion.
                      </p>
                      <div className="space-y-2 text-xs text-muted-foreground">
                        <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                          Crea una alerta para anunciar un nuevo servicio de color premium.
                        </div>
                        <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                          Avisa del cierre del salon este sabado por la tarde.
                        </div>
                        <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                          Alerta informativa para felicitar San Valentin a los clientes.
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}
              <AccordionItem value="audio" className="border-border/60">
                <AccordionTrigger className="text-sm">Audio y escucha: manos libres</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Pulsa el microfono para dictar y vuelve a pulsarlo para detener. Si dices "enviar" al final, el
                      mensaje se enviara automaticamente. Si no, la transcripcion quedara en el campo de texto para
                      revisarla y luego enviarla. Ademas, puedes escuchar cualquier respuesta del asistente.
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
              {canCreateAlerts && (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() =>
                    applyTemplate('Crea una alerta para [motivo o anuncio] dirigida a los clientes.')
                  }
                  disabled={isSending || isTranscribing || isRecording}
                >
                  Crear alerta
                </Button>
              )}
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
