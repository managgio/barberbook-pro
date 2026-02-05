import { useMemo } from 'react';
import { TenantBusinessType } from '@/data/types';
import { useTenant } from '@/context/TenantContext';

type NumberKey = 'singular' | 'plural';
type GenderKey = 'masculine' | 'feminine' | 'common';

type BusinessDictionaryEntry = {
  label: string;
  staff: {
    singular: string;
    plural: string;
    gender: GenderKey;
    collective?: boolean;
  };
  location: {
    singular: string;
    plural: string;
    gender: GenderKey;
    collective?: boolean;
  };
};

const BUSINESS_COPY: Record<TenantBusinessType, BusinessDictionaryEntry> = {
  barbershop: {
    label: 'Barbería',
    staff: { singular: 'Barbero', plural: 'Barberos', gender: 'masculine' },
    location: { singular: 'Barbería', plural: 'Barberías', gender: 'feminine' },
  },
  hair_salon: {
    label: 'Peluquería',
    staff: { singular: 'Estilista', plural: 'Estilistas', gender: 'common' },
    location: { singular: 'Peluquería', plural: 'Peluquerías', gender: 'feminine' },
  },
  aesthetics: {
    label: 'Estética',
    staff: { singular: 'Profesional', plural: 'Profesionales', gender: 'common' },
    location: { singular: 'Centro de estética', plural: 'Centros de estética', gender: 'masculine' },
  },
  nails: {
    label: 'Uñas',
    staff: { singular: 'Técnica', plural: 'Técnicas', gender: 'feminine' },
    location: { singular: 'Estudio de uñas', plural: 'Estudios de uñas', gender: 'masculine' },
  },
  physio: {
    label: 'Fisio',
    staff: { singular: 'Especialista', plural: 'Especialistas', gender: 'common' },
    location: { singular: 'Clínica', plural: 'Clínicas', gender: 'feminine' },
  },
  clinic: {
    label: 'Clínica',
    staff: { singular: 'Profesional', plural: 'Profesionales', gender: 'common' },
    location: { singular: 'Clínica', plural: 'Clínicas', gender: 'feminine' },
  },
  mixed_center: {
    label: 'Centro mixto',
    staff: { singular: 'Equipo', plural: 'Equipo', gender: 'masculine', collective: true },
    location: { singular: 'Centro', plural: 'Centros', gender: 'masculine' },
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

const buildNounTerms = (entry: { singular: string; plural: string; gender: GenderKey; collective?: boolean }) => {
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

export const getAllNounLabel = (noun: NounCopy) => {
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

export const getBusinessCopy = (type?: string | null): BusinessCopy => {
  const businessType = resolveBusinessType(type);
  const entry = BUSINESS_COPY[businessType];
  return {
    type: businessType,
    label: entry.label,
    staff: buildNounTerms(entry.staff),
    location: buildNounTerms(entry.location),
  };
};

export const BUSINESS_TYPE_OPTIONS = (
  Object.keys(BUSINESS_COPY) as TenantBusinessType[]
).map((key) => ({
  value: key,
  label: BUSINESS_COPY[key].label,
  staffSingular: BUSINESS_COPY[key].staff.singular,
  staffPlural: BUSINESS_COPY[key].staff.plural,
  locationSingular: BUSINESS_COPY[key].location.singular,
}));

export const useBusinessCopy = () => {
  const { tenant } = useTenant();
  const businessType = tenant?.config?.business?.type;
  return useMemo(() => getBusinessCopy(businessType), [businessType]);
};
