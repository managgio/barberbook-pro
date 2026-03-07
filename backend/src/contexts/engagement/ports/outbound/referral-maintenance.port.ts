export const ENGAGEMENT_REFERRAL_MAINTENANCE_PORT = Symbol('ENGAGEMENT_REFERRAL_MAINTENANCE_PORT');

export interface EngagementReferralMaintenancePort {
  expireAttributions(): Promise<number>;
  cleanupStaleHolds(): Promise<number>;
}
