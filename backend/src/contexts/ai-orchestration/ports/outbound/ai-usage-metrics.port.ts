export const AI_USAGE_METRICS_PORT = Symbol('AI_USAGE_METRICS_PORT');

export interface AiUsageMetricsPort {
  recordOpenAiUsage(input: {
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  }): Promise<void>;
}
