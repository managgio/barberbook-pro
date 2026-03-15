export type LocalizableEntityType =
  | 'service'
  | 'service_category'
  | 'product'
  | 'product_category'
  | 'alert'
  | 'site_settings'
  | 'offer'
  | 'loyalty_program'
  | 'subscription_plan'
  | 'barber'
  | 'review_config';

export type LocalizedFieldKey = string;

export type LocalizedScope = 'brand' | 'location';

export type LocalizableSourceFields = Record<LocalizedFieldKey, string | null | undefined>;

export type LocalizationPolicy = {
  defaultLanguage: string;
  supportedLanguages: string[];
  autoTranslateEnabled: boolean;
  autoTranslatePaused: boolean;
  autoTranslatePauseUntil: string | null;
  retryAttempts: number;
  monthlyRequestLimit: number | null;
  monthlyCharacterLimit: number | null;
  circuitBreaker: {
    enabled: boolean;
    failureRateThreshold: number;
    minSamples: number;
    consecutiveFailures: number;
    windowMinutes: number;
    pauseMinutes: number;
  };
};

export type LocalizedFieldDescriptor<T extends Record<string, unknown>> = {
  fieldKey: string;
  getValue: (item: T) => string | null | undefined;
  setValue: (item: T, value: string) => void;
};
