-- Add payment tracking fields for user subscriptions
ALTER TABLE `UserSubscription`
  ADD COLUMN `paymentStatus` ENUM('pending', 'paid', 'failed', 'cancelled', 'exempt', 'in_person') NOT NULL DEFAULT 'paid',
  ADD COLUMN `paymentMethod` ENUM('cash', 'card', 'bizum', 'stripe') NULL,
  ADD COLUMN `paymentAmount` DECIMAL(10, 2) NULL,
  ADD COLUMN `paymentCurrency` VARCHAR(10) NULL,
  ADD COLUMN `paymentPaidAt` DATETIME(3) NULL,
  ADD COLUMN `stripePaymentIntentId` VARCHAR(191) NULL,
  ADD COLUMN `stripeCheckoutSessionId` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `UserSubscription_stripePaymentIntentId_key` ON `UserSubscription`(`stripePaymentIntentId`);
CREATE UNIQUE INDEX `UserSubscription_stripeCheckoutSessionId_key` ON `UserSubscription`(`stripeCheckoutSessionId`);
CREATE INDEX `UserSubscription_localId_paymentStatus_idx` ON `UserSubscription`(`localId`, `paymentStatus`);
