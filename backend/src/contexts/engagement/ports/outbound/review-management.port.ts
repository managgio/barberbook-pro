export const ENGAGEMENT_REVIEW_MANAGEMENT_PORT = Symbol('ENGAGEMENT_REVIEW_MANAGEMENT_PORT');

export type EngagementReviewActor = {
  userId?: string;
  guestEmail?: string;
  guestPhone?: string;
};

export type EngagementReviewCopyPayload = {
  title: string;
  subtitle: string;
  positiveText: string;
  positiveCta: string;
  negativeText: string;
  negativeCta: string;
  snoozeCta: string;
};

export type EngagementReviewConfigPayload = {
  id: string | null;
  localId: string;
  enabled: boolean;
  googleReviewUrl: string | null;
  cooldownDays: number;
  minVisitsToAsk: number;
  showDelayMinutes: number;
  maxSnoozes: number;
  snoozeHours: number;
  copyJson: EngagementReviewCopyPayload;
};

export type EngagementUpdateReviewConfigInput = Partial<
  Omit<EngagementReviewConfigPayload, 'id' | 'localId' | 'copyJson'>
> & {
  copyJson?: Partial<EngagementReviewCopyPayload>;
};

export interface EngagementReviewManagementPort {
  isModuleEnabled(): Promise<boolean>;
  getConfig(): Promise<EngagementReviewConfigPayload>;
  getConfigRaw(): Promise<unknown>;
  updateConfig(data: EngagementUpdateReviewConfigInput): Promise<EngagementReviewConfigPayload>;
  handleAppointmentCompleted(appointmentId: string): Promise<unknown>;
  getPendingReview(actor: EngagementReviewActor): Promise<unknown>;
  markShown(id: string, actor: EngagementReviewActor): Promise<unknown>;
  rate(id: string, rating: number, actor: EngagementReviewActor): Promise<unknown>;
  submitFeedback(id: string, text: string, actor: EngagementReviewActor): Promise<unknown>;
  markClicked(id: string, actor: EngagementReviewActor): Promise<unknown>;
  snooze(id: string, actor: EngagementReviewActor): Promise<unknown>;
  getMetrics(params?: { from?: Date; to?: Date }): Promise<unknown>;
  listFeedback(params: { status?: string; page: number; pageSize: number }): Promise<unknown>;
  resolveFeedback(id: string): Promise<unknown>;
}
