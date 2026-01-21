import { LegalSubProcessor } from './legal.types';

export const DEFAULT_AI_PROVIDERS = ['OpenAI'];

export const DEFAULT_SUBPROCESSORS: LegalSubProcessor[] = [
  {
    name: 'Firebase Auth (Google)',
    purpose: 'Autenticacion de usuarios y gestion de acceso.',
    country: 'EE.UU.',
    dataTypes: 'Identificacion, email, metadatos de acceso.',
    link: 'https://firebase.google.com/support/privacy',
  },
  {
    name: 'Twilio',
    purpose: 'Envio de SMS de recordatorio y notificaciones.',
    country: 'EE.UU.',
    dataTypes: 'Telefono, estado de mensajes.',
    link: 'https://www.twilio.com/legal/privacy',
  },
  {
    name: 'OpenAI',
    purpose: 'Asistente IA (chat/transcripcion).',
    country: 'EE.UU.',
    dataTypes: 'Contenido de mensajes, audio transcrito.',
    link: 'https://openai.com/policies/privacy-policy',
  },
  {
    name: 'ImageKit',
    purpose: 'Almacenamiento y entrega de imagenes.',
    country: 'EE.UU.',
    dataTypes: 'Imagenes y metadatos.',
    link: 'https://imagekit.io/privacy-policy',
  },
  {
    name: 'Proveedor SMTP',
    purpose: 'Envio de emails transaccionales.',
    country: 'UE/EE.UU.',
    dataTypes: 'Email, contenido del mensaje.',
    link: 'https://www.cloudflare.com/es-es/learning/email-security/what-is-smtp/',
  },
];
