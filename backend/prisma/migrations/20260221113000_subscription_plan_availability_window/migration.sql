-- Add programmable availability window for customer self-subscription
ALTER TABLE `SubscriptionPlan`
  ADD COLUMN `availabilityStartDate` DATETIME(3) NULL,
  ADD COLUMN `availabilityEndDate` DATETIME(3) NULL;

CREATE INDEX `SubscriptionPlan_localId_isArchived_isActive_availability_idx`
  ON `SubscriptionPlan`(`localId`, `isArchived`, `isActive`, `availabilityStartDate`, `availabilityEndDate`);
