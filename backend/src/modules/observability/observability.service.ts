import { Inject, Injectable } from '@nestjs/common';
import { GetApiMetricsSummaryUseCase } from '../../contexts/platform/application/use-cases/get-api-metrics-summary.use-case';
import { GetWebVitalsSummaryUseCase } from '../../contexts/platform/application/use-cases/get-web-vitals-summary.use-case';
import { RecordApiMetricUseCase } from '../../contexts/platform/application/use-cases/record-api-metric.use-case';
import { RecordWebVitalUseCase } from '../../contexts/platform/application/use-cases/record-web-vital.use-case';
import {
  PlatformApiMetricRecord,
  PlatformWebVitalContext,
  PlatformWebVitalReport,
} from '../../contexts/platform/domain/entities/platform-observability.entity';
import {
  PLATFORM_OBSERVABILITY_PORT,
  PlatformObservabilityPort,
} from '../../contexts/platform/ports/outbound/platform-observability.port';

@Injectable()
export class ObservabilityService {
  private readonly recordWebVitalUseCase: RecordWebVitalUseCase;
  private readonly recordApiMetricUseCase: RecordApiMetricUseCase;
  private readonly getWebVitalsSummaryUseCase: GetWebVitalsSummaryUseCase;
  private readonly getApiMetricsSummaryUseCase: GetApiMetricsSummaryUseCase;

  constructor(
    @Inject(PLATFORM_OBSERVABILITY_PORT)
    private readonly platformObservabilityPort: PlatformObservabilityPort,
  ) {
    this.recordWebVitalUseCase = new RecordWebVitalUseCase(this.platformObservabilityPort);
    this.recordApiMetricUseCase = new RecordApiMetricUseCase(this.platformObservabilityPort);
    this.getWebVitalsSummaryUseCase = new GetWebVitalsSummaryUseCase(this.platformObservabilityPort);
    this.getApiMetricsSummaryUseCase = new GetApiMetricsSummaryUseCase(this.platformObservabilityPort);
  }

  recordWebVital(payload: PlatformWebVitalReport, context: PlatformWebVitalContext) {
    void this.recordWebVitalUseCase.execute({ payload, context });
  }

  recordApiMetric(record: PlatformApiMetricRecord) {
    void this.recordApiMetricUseCase.execute({ record });
  }

  getWebVitalsSummary(windowMinutes?: number) {
    return this.getWebVitalsSummaryUseCase.execute({ windowMinutes });
  }

  getApiMetricsSummary(windowMinutes?: number) {
    return this.getApiMetricsSummaryUseCase.execute({ windowMinutes });
  }
}
