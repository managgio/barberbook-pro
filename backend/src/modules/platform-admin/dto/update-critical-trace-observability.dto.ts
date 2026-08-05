import { IsBoolean } from 'class-validator';

export class UpdateCriticalTraceObservabilityDto {
  @IsBoolean()
  includeInPdf!: boolean;
}
