/*
  Warnings:

  - A unique constraint covering the columns `[stripePaymentIntentId]` on the table `Appointment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[stripeCheckoutSessionId]` on the table `Appointment` will be added. If there are existing duplicate values, this will fail.

*/
-- Ensure paymentMethod exists before modifying (for shadow DB)
SET @appointment_payment_method_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'Appointment'
    AND column_name = 'paymentMethod'
);

SET @add_payment_method_sql := IF(
  @appointment_payment_method_exists = 0,
  'ALTER TABLE `Appointment` ADD COLUMN `paymentMethod` ENUM(''cash'',''card'',''bizum'',''stripe'') NULL',
  'SELECT 1'
);
PREPARE stmt FROM @add_payment_method_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- AlterTable
ALTER TABLE `Appointment` ADD COLUMN `paymentAmount` DECIMAL(10, 2) NULL,
    ADD COLUMN `paymentCurrency` VARCHAR(10) NULL,
    ADD COLUMN `paymentExpiresAt` DATETIME(3) NULL,
    ADD COLUMN `paymentPaidAt` DATETIME(3) NULL,
    ADD COLUMN `paymentStatus` ENUM('pending', 'paid', 'failed', 'cancelled', 'exempt', 'in_person') NOT NULL DEFAULT 'in_person',
    ADD COLUMN `stripeCheckoutSessionId` VARCHAR(191) NULL,
    ADD COLUMN `stripePaymentIntentId` VARCHAR(191) NULL,
    MODIFY `paymentMethod` ENUM('cash', 'card', 'bizum', 'stripe') NULL;

-- Update CashMovement method enum if the table exists
SET @cashmovement_exists := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'CashMovement'
);
SET @cashmovement_method_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'CashMovement'
    AND column_name = 'method'
);
SET @modify_cashmovement_sql := IF(
  @cashmovement_exists > 0 AND @cashmovement_method_exists > 0,
  'ALTER TABLE `CashMovement` MODIFY `method` ENUM(''cash'',''card'',''bizum'',''stripe'') NULL',
  'SELECT 1'
);
PREPARE stmt FROM @modify_cashmovement_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- CreateIndex
CREATE UNIQUE INDEX `Appointment_stripePaymentIntentId_key` ON `Appointment`(`stripePaymentIntentId`);

-- CreateIndex
CREATE UNIQUE INDEX `Appointment_stripeCheckoutSessionId_key` ON `Appointment`(`stripeCheckoutSessionId`);
