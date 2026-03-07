import {
  PlatformWebVitalContext,
  PlatformWebVitalReport,
} from '../../domain/entities/platform-observability.entity';

export type RecordWebVitalCommand = {
  payload: PlatformWebVitalReport;
  context: PlatformWebVitalContext;
};

