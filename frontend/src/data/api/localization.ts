import {
  LocalizableEntityType,
  LocalizedEntityField,
  LocalizedEntitySummary,
  QueueLocalizationRegenerationResult,
} from '@/data/types';

import { apiRequest } from './request';

export const getEntityTranslations = async (
  entityType: LocalizableEntityType,
  entityId: string,
): Promise<LocalizedEntityField[]> =>
  apiRequest(`/localization/entity/${entityType}/${entityId}`);

export const getEntityTranslationSummaries = async (
  entityType: LocalizableEntityType,
  entityIds: string[],
): Promise<LocalizedEntitySummary[]> => {
  const ids = entityIds.map((entry) => entry.trim()).filter(Boolean);
  if (ids.length === 0) return [];
  return apiRequest(`/localization/summary/${entityType}`, {
    query: { ids: ids.join(',') },
  });
};

export const upsertManualTranslation = async (params: {
  entityType: LocalizableEntityType;
  entityId: string;
  fieldKey: string;
  language: string;
  translatedText: string;
  manualLocked?: boolean;
}) =>
  apiRequest('/localization/manual', {
    method: 'PATCH',
    body: params,
  });

export const queueLocalizationRegeneration = async (params: {
  entityType: LocalizableEntityType;
  entityId: string;
  fieldKey?: string;
  languages?: string[];
  forceManual?: boolean;
}): Promise<QueueLocalizationRegenerationResult> =>
  apiRequest('/localization/regenerate', {
    method: 'POST',
    body: params,
  });
