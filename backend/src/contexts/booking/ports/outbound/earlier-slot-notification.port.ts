import { NotifyEarlierSlotOpportunityCommand } from '../../application/commands/notify-earlier-slot-opportunity.command';

export const EARLIER_SLOT_NOTIFICATION_PORT = Symbol('EARLIER_SLOT_NOTIFICATION_PORT');

export interface EarlierSlotNotificationPort {
  notifyFirstEligibleRequest(command: NotifyEarlierSlotOpportunityCommand): Promise<boolean>;
}
