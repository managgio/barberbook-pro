import { LegalContentResponse, LegalCustomSections, LegalPageType, LegalSection, LegalSettingsResolved } from './legal.types';

const toDateString = (date: Date) => date.toISOString().split('T')[0];

const appendCustomSections = (base: LegalSection[], custom?: LegalSection[]) => {
  if (!custom || !Array.isArray(custom) || custom.length === 0) return base;
  return [...base, ...custom.filter((section) => section && section.heading && section.bodyMarkdown)];
};

const buildPrivacySections = (settings: LegalSettingsResolved): LegalSection[] => {
  const retentionLine = settings.retentionDays
    ? `Conservamos los datos durante ${settings.retentionDays} dias desde la fecha de la cita o hasta que se solicite su supresion.`
    : 'Conservamos los datos el tiempo imprescindible para gestionar la cita y cumplir obligaciones legales.';

  return [
    {
      heading: 'Responsable del tratamiento',
      bodyMarkdown:
        `El responsable del tratamiento es **${settings.ownerName}**. ` +
        `Para cualquier consulta sobre privacidad puedes escribir a **${settings.contactEmail || 'pendiente de configurar'}**.`,
    },
    {
      heading: 'Datos que tratamos',
      bodyMarkdown:
        'Tratamos datos identificativos y de contacto, detalles de la cita, preferencias de servicio y comunicaciones asociadas.',
    },
    {
      heading: 'Finalidades',
      bodyMarkdown:
        'Gestionar reservas, prestar el servicio, enviar notificaciones relacionadas con la cita y atender solicitudes.',
    },
    {
      heading: 'Base legal',
      bodyMarkdown:
        'La base legal es la ejecucion del servicio solicitado y el consentimiento cuando sea necesario.',
    },
    {
      heading: 'Conservacion',
      bodyMarkdown: retentionLine,
    },
    {
      heading: 'Derechos',
      bodyMarkdown:
        'Puedes ejercer los derechos de acceso, rectificacion, supresion, oposicion, limitacion y portabilidad escribiendo al contacto indicado.',
    },
  ];
};

const buildCookieSections = (): LegalSection[] => [
  {
    heading: 'Que son las cookies',
    bodyMarkdown:
      'Las cookies son pequenos archivos que se almacenan en tu navegador para recordar preferencias y mejorar la experiencia.',
  },
  {
    heading: 'Cookies utilizadas',
    bodyMarkdown:
      'Utilizamos cookies tecnicas necesarias para el funcionamiento del sitio y, si se habilita en el futuro, cookies de analitica previa aceptacion.',
  },
  {
    heading: 'Gestion de cookies',
    bodyMarkdown:
      'Puedes eliminar o bloquear las cookies desde la configuracion de tu navegador. Ten en cuenta que esto puede afectar al funcionamiento.',
  },
];

const buildNoticeSections = (): LegalSection[] => [
  {
    heading: 'Informacion general',
    bodyMarkdown:
      'Este sitio web proporciona informacion sobre servicios y permite gestionar reservas de citas.',
  },
  {
    heading: 'Condiciones de uso',
    bodyMarkdown:
      'El acceso implica la aceptacion de estas condiciones y el compromiso de uso responsable de los contenidos.',
  },
  {
    heading: 'Propiedad intelectual',
    bodyMarkdown:
      'Los contenidos, marcas y elementos graficos son titularidad de sus propietarios y estan protegidos por la normativa vigente.',
  },
  {
    heading: 'Responsabilidad',
    bodyMarkdown:
      'No nos hacemos responsables de interrupciones o errores derivados de causas ajenas o mantenimiento del servicio.',
  },
];

const buildDpaSections = (settings: LegalSettingsResolved): LegalSection[] => [
  {
    heading: 'Partes',
    bodyMarkdown:
      `El cliente (**${settings.ownerName}**) actua como responsable del tratamiento. ` +
      'Managgio actua como encargado del tratamiento para la gestion de la plataforma.',
  },
  {
    heading: 'Objeto y duracion',
    bodyMarkdown:
      'El presente acuerdo regula el tratamiento de datos personales necesario para prestar el servicio mientras exista la relacion contractual.',
  },
  {
    heading: 'Obligaciones del encargado',
    bodyMarkdown:
      'Managgio tratara los datos siguiendo instrucciones documentadas, aplicara medidas de seguridad y asistira en el ejercicio de derechos.',
  },
  {
    heading: 'Subencargados',
    bodyMarkdown:
      'El encargado podra apoyarse en subencargados enumerados en esta politica, garantizando acuerdos equivalentes.',
  },
  {
    heading: 'Medidas de seguridad',
    bodyMarkdown:
      'Se aplican medidas tecnicas y organizativas proporcionadas al riesgo, incluyendo control de acceso, cifrado en transito y registros de actividad.',
  },
];

export const buildLegalContent = (
  type: LegalPageType,
  settings: LegalSettingsResolved,
  customSections: LegalCustomSections,
): LegalContentResponse => {
  const effectiveDate = toDateString(settings.updatedAt);
  const baseBusinessIdentity = {
    ownerName: settings.ownerName,
    taxId: settings.taxId,
    address: settings.address,
    contactEmail: settings.contactEmail,
    contactPhone: settings.contactPhone,
    country: settings.country,
  };

  if (type === 'privacy') {
    const sections = appendCustomSections(buildPrivacySections(settings), customSections.privacy);
    const aiDisclosure =
      settings.aiDisclosureEnabled && settings.aiProviderNames.length > 0
        ? {
            title: 'Transparencia sobre IA',
            providerNames: settings.aiProviderNames,
            bodyMarkdown:
              `Utilizamos proveedores de IA (${settings.aiProviderNames.join(', ')}) para funciones como asistencia conversacional o transcripcion. ` +
              'Estos proveedores pueden procesar datos estrictamente necesarios para la funcion solicitada.',
          }
        : null;
    return {
      title: 'Politica de privacidad',
      effectiveDate,
      version: settings.privacyPolicyVersion,
      sections,
      businessIdentity: baseBusinessIdentity,
      subProcessors: settings.subProcessors,
      aiDisclosure,
    };
  }

  if (type === 'cookies') {
    const sections = appendCustomSections(buildCookieSections(), customSections.cookies);
    return {
      title: 'Politica de cookies',
      effectiveDate,
      version: settings.cookiePolicyVersion,
      sections,
      businessIdentity: baseBusinessIdentity,
    };
  }

  if (type === 'notice') {
    const sections = appendCustomSections(buildNoticeSections(), customSections.notice);
    return {
      title: 'Aviso legal',
      effectiveDate,
      version: settings.legalNoticeVersion,
      sections,
      businessIdentity: baseBusinessIdentity,
    };
  }

  const sections = appendCustomSections(buildDpaSections(settings), customSections.dpa);
  return {
    title: 'Contrato de encargo del tratamiento',
    effectiveDate,
    version: settings.privacyPolicyVersion,
    sections,
    businessIdentity: baseBusinessIdentity,
    subProcessors: settings.subProcessors,
  };
};
