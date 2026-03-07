import {
  EngagementReviewActor,
  EngagementReviewManagementPort,
  EngagementUpdateReviewConfigInput,
} from '../../ports/outbound/review-management.port';

export class ManageReviewsUseCase {
  constructor(private readonly reviewManagementPort: EngagementReviewManagementPort) {}

  isModuleEnabled() {
    return this.reviewManagementPort.isModuleEnabled();
  }

  getConfig() {
    return this.reviewManagementPort.getConfig();
  }

  getConfigRaw() {
    return this.reviewManagementPort.getConfigRaw();
  }

  updateConfig(data: EngagementUpdateReviewConfigInput) {
    return this.reviewManagementPort.updateConfig(data);
  }

  handleAppointmentCompleted(appointmentId: string) {
    return this.reviewManagementPort.handleAppointmentCompleted(appointmentId);
  }

  getPendingReview(actor: EngagementReviewActor) {
    return this.reviewManagementPort.getPendingReview(actor);
  }

  markShown(id: string, actor: EngagementReviewActor) {
    return this.reviewManagementPort.markShown(id, actor);
  }

  rate(id: string, rating: number, actor: EngagementReviewActor) {
    return this.reviewManagementPort.rate(id, rating, actor);
  }

  submitFeedback(id: string, text: string, actor: EngagementReviewActor) {
    return this.reviewManagementPort.submitFeedback(id, text, actor);
  }

  markClicked(id: string, actor: EngagementReviewActor) {
    return this.reviewManagementPort.markClicked(id, actor);
  }

  snooze(id: string, actor: EngagementReviewActor) {
    return this.reviewManagementPort.snooze(id, actor);
  }

  getMetrics(params?: { from?: Date; to?: Date }) {
    return this.reviewManagementPort.getMetrics(params);
  }

  listFeedback(params: { status?: string; page: number; pageSize: number }) {
    return this.reviewManagementPort.listFeedback(params);
  }

  resolveFeedback(id: string) {
    return this.reviewManagementPort.resolveFeedback(id);
  }
}
