import { createContext } from 'react';

export type LanguageContextValue = {
  language: string;
  defaultLanguage: string;
  supportedLanguages: string[];
  setLanguage: (language: string, options?: { persistForUser?: boolean }) => void;
};

export const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);
