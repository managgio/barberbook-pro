export const TRANSLATION_PROVIDER_PORT = Symbol('TRANSLATION_PROVIDER_PORT');

export type TranslateTextInput = {
  apiKey: string;
  model: string;
  sourceLanguage: string;
  targetLanguage: string;
  text: string;
};

export interface TranslationProviderPort {
  translateText(input: TranslateTextInput): Promise<{ translatedText: string }>;
}
