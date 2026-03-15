import { useMemo } from 'react';
import { TenantBusinessType } from '@/data/types';
import { useTenant } from '@/context/TenantContext';
import { useLanguage } from '@/hooks/useLanguage';

type NumberKey = 'singular' | 'plural';
type GenderKey = 'masculine' | 'feminine' | 'common';
type SupportedBusinessCopyLanguage = 'es' | 'en';

type SpanishNounDefinition = {
  singular: string;
  plural: string;
  gender: GenderKey;
  collective?: boolean;
};

type EnglishNounDefinition = {
  singular: string;
  plural: string;
  collective?: boolean;
};

type LocalizedNounDefinition = {
  es: SpanishNounDefinition;
  en: EnglishNounDefinition;
};

type BusinessDictionaryEntry = {
  label: Record<SupportedBusinessCopyLanguage, string>;
  staff: LocalizedNounDefinition;
  location: LocalizedNounDefinition;
};

const resolveCopyLanguage = (value?: string | null): SupportedBusinessCopyLanguage => {
  const base = (value || '').trim().toLowerCase().split('-')[0];
  return base === 'en' ? 'en' : 'es';
};

const BUSINESS_COPY: Record<TenantBusinessType, BusinessDictionaryEntry> = {
  barbershop: {
    label: { es: 'Barbería', en: 'Barbershop' },
    staff: {
      es: { singular: 'Barbero', plural: 'Barberos', gender: 'masculine' },
      en: { singular: 'Barber', plural: 'Barbers' },
    },
    location: {
      es: { singular: 'Barbería', plural: 'Barberías', gender: 'feminine' },
      en: { singular: 'Barbershop', plural: 'Barbershops' },
    },
  },
  hair_salon: {
    label: { es: 'Peluquería', en: 'Hair salon' },
    staff: {
      es: { singular: 'Estilista', plural: 'Estilistas', gender: 'common' },
      en: { singular: 'Stylist', plural: 'Stylists' },
    },
    location: {
      es: { singular: 'Peluquería', plural: 'Peluquerías', gender: 'feminine' },
      en: { singular: 'Hair salon', plural: 'Hair salons' },
    },
  },
  aesthetics: {
    label: { es: 'Estética', en: 'Aesthetics' },
    staff: {
      es: { singular: 'Profesional', plural: 'Profesionales', gender: 'common' },
      en: { singular: 'Professional', plural: 'Professionals' },
    },
    location: {
      es: { singular: 'Centro de estética', plural: 'Centros de estética', gender: 'masculine' },
      en: { singular: 'Aesthetics center', plural: 'Aesthetics centers' },
    },
  },
  nails: {
    label: { es: 'Uñas', en: 'Nails' },
    staff: {
      es: { singular: 'Técnica', plural: 'Técnicas', gender: 'feminine' },
      en: { singular: 'Technician', plural: 'Technicians' },
    },
    location: {
      es: { singular: 'Estudio de uñas', plural: 'Estudios de uñas', gender: 'masculine' },
      en: { singular: 'Nail studio', plural: 'Nail studios' },
    },
  },
  physio: {
    label: { es: 'Fisio', en: 'Physio' },
    staff: {
      es: { singular: 'Especialista', plural: 'Especialistas', gender: 'common' },
      en: { singular: 'Specialist', plural: 'Specialists' },
    },
    location: {
      es: { singular: 'Clínica', plural: 'Clínicas', gender: 'feminine' },
      en: { singular: 'Clinic', plural: 'Clinics' },
    },
  },
  clinic: {
    label: { es: 'Clínica', en: 'Clinic' },
    staff: {
      es: { singular: 'Profesional', plural: 'Profesionales', gender: 'common' },
      en: { singular: 'Professional', plural: 'Professionals' },
    },
    location: {
      es: { singular: 'Clínica', plural: 'Clínicas', gender: 'feminine' },
      en: { singular: 'Clinic', plural: 'Clinics' },
    },
  },
  mixed_center: {
    label: { es: 'Centro mixto', en: 'Mixed center' },
    staff: {
      es: { singular: 'Equipo', plural: 'Equipo', gender: 'masculine', collective: true },
      en: { singular: 'Team', plural: 'Team', collective: true },
    },
    location: {
      es: { singular: 'Centro', plural: 'Centros', gender: 'masculine' },
      en: { singular: 'Center', plural: 'Centers' },
    },
  },
};

const toLower = (value: string) => {
  if (!value) return value;
  return value.charAt(0).toLowerCase() + value.slice(1);
};

const resolveArticle = (
  gender: GenderKey,
  number: NumberKey,
  kind: 'definite' | 'indefinite',
) => {
  if (kind === 'definite') {
    if (gender === 'feminine') return number === 'singular' ? 'la' : 'las';
    if (gender === 'common') return number === 'singular' ? 'el/la' : 'los/las';
    return number === 'singular' ? 'el' : 'los';
  }
  if (gender === 'feminine') return number === 'singular' ? 'una' : 'unas';
  if (gender === 'common') return number === 'singular' ? 'un/a' : 'unos/as';
  return number === 'singular' ? 'un' : 'unos';
};

const resolveArticleWithPreposition = (
  preposition: 'a' | 'de' | 'en',
  gender: GenderKey,
  number: NumberKey,
) => {
  const base = resolveArticle(gender, number, 'definite');
  if (number === 'singular' && gender === 'masculine') {
    if (preposition === 'a') return 'al';
    if (preposition === 'de') return 'del';
  }
  return `${preposition} ${base}`;
};

const buildSpanishNounTerms = (entry: SpanishNounDefinition) => {
  const singularLower = toLower(entry.singular);
  const pluralLower = toLower(entry.plural);
  const definiteSingularArticle = resolveArticle(entry.gender, 'singular', 'definite');
  const pluralNumberKey: NumberKey = entry.collective ? 'singular' : 'plural';
  const definitePluralArticle = resolveArticle(entry.gender, pluralNumberKey, 'definite');
  const indefiniteSingularArticle = resolveArticle(entry.gender, 'singular', 'indefinite');
  const indefinitePluralArticle = resolveArticle(entry.gender, pluralNumberKey, 'indefinite');

  return {
    singular: entry.singular,
    plural: entry.plural,
    gender: entry.gender,
    singularLower,
    pluralLower,
    isCollective: Boolean(entry.collective),
    definiteSingularArticle,
    definitePluralArticle,
    indefiniteSingularArticle,
    indefinitePluralArticle,
    definiteSingular: `${definiteSingularArticle} ${singularLower}`,
    definitePlural: `${definitePluralArticle} ${pluralLower}`,
    indefiniteSingular: `${indefiniteSingularArticle} ${singularLower}`,
    indefinitePlural: `${indefinitePluralArticle} ${pluralLower}`,
    toWithDefinite: `${resolveArticleWithPreposition('a', entry.gender, 'singular')} ${singularLower}`,
    fromWithDefinite: `${resolveArticleWithPreposition('de', entry.gender, 'singular')} ${singularLower}`,
    inWithDefinite: `${resolveArticleWithPreposition('en', entry.gender, 'singular')} ${singularLower}`,
    toWithDefinitePlural: `${resolveArticleWithPreposition('a', entry.gender, pluralNumberKey)} ${pluralLower}`,
    fromWithDefinitePlural: `${resolveArticleWithPreposition('de', entry.gender, pluralNumberKey)} ${pluralLower}`,
    inWithDefinitePlural: `${resolveArticleWithPreposition('en', entry.gender, pluralNumberKey)} ${pluralLower}`,
  };
};

const buildEnglishNounTerms = (entry: EnglishNounDefinition) => {
  const singularLower = toLower(entry.singular);
  const pluralLower = toLower(entry.plural);
  const indefiniteSingularArticle = /^[aeiou]/i.test(singularLower) ? 'an' : 'a';
  return {
    language: 'en' as const,
    singular: entry.singular,
    plural: entry.plural,
    gender: 'common' as const,
    singularLower,
    pluralLower,
    isCollective: Boolean(entry.collective),
    definiteSingularArticle: 'the',
    definitePluralArticle: 'the',
    indefiniteSingularArticle,
    indefinitePluralArticle: 'some',
    definiteSingular: `the ${singularLower}`,
    definitePlural: `the ${pluralLower}`,
    indefiniteSingular: `${indefiniteSingularArticle} ${singularLower}`,
    indefinitePlural: `some ${pluralLower}`,
    toWithDefinite: `for the ${singularLower}`,
    fromWithDefinite: `for the ${singularLower}`,
    inWithDefinite: `at the ${singularLower}`,
    toWithDefinitePlural: `for the ${pluralLower}`,
    fromWithDefinitePlural: `for the ${pluralLower}`,
    inWithDefinitePlural: `with the ${pluralLower}`,
  };
};

export const getAllNounLabel = (noun: NounCopy) => {
  if (noun.language === 'en') {
    return `All ${noun.isCollective ? noun.singularLower : noun.pluralLower}`;
  }
  if (noun.isCollective) {
    return `Todo ${noun.definiteSingular}`;
  }
  if (noun.gender === 'feminine') {
    return `Todas ${noun.definitePlural}`;
  }
  if (noun.gender === 'common') {
    return `Todos/as ${noun.definitePlural}`;
  }
  return `Todos ${noun.definitePlural}`;
};

export const resolveBusinessType = (type?: string | null): TenantBusinessType => {
  if (type && type in BUSINESS_COPY) {
    return type as TenantBusinessType;
  }
  return 'barbershop';
};

export type NounCopy = ReturnType<typeof buildNounTerms>;

export type BusinessCopy = {
  type: TenantBusinessType;
  label: string;
  staff: NounCopy;
  location: NounCopy;
};

export const getBusinessCopy = (type?: string | null, language?: string | null): BusinessCopy => {
  const resolvedLanguage = resolveCopyLanguage(language);
  const businessType = resolveBusinessType(type);
  const entry = BUSINESS_COPY[businessType];
  return {
    type: businessType,
    label: entry.label[resolvedLanguage],
    staff: resolvedLanguage === 'en' ? buildEnglishNounTerms(entry.staff.en) : buildSpanishNounTerms(entry.staff.es),
    location: resolvedLanguage === 'en' ? buildEnglishNounTerms(entry.location.en) : buildSpanishNounTerms(entry.location.es),
  };
};

export const BUSINESS_TYPE_OPTIONS = (
  Object.keys(BUSINESS_COPY) as TenantBusinessType[]
).map((key) => ({
  value: key,
  label: BUSINESS_COPY[key].label.es,
  staffSingular: BUSINESS_COPY[key].staff.es.singular,
  staffPlural: BUSINESS_COPY[key].staff.es.plural,
  locationSingular: BUSINESS_COPY[key].location.es.singular,
}));

export const useBusinessCopy = () => {
  const { tenant } = useTenant();
  const { language } = useLanguage();
  const businessType = tenant?.config?.business?.type;
  return useMemo(() => getBusinessCopy(businessType, language), [businessType, language]);
};
