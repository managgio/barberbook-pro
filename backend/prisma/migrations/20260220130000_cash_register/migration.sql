-- AlterTable (guarded for shadow DB)
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

-- CreateTable
CREATE TABLE `CashMovement` (
    `id` VARCHAR(191) NOT NULL,
    `localId` VARCHAR(191) NOT NULL,
    `type` ENUM('in', 'out') NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `method` ENUM('cash', 'card', 'bizum', 'stripe') NULL,
    `note` VARCHAR(191) NULL,
    `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CashMovement_localId_idx`(`localId`),
    INDEX `CashMovement_occurredAt_idx`(`occurredAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CashMovement` ADD CONSTRAINT `CashMovement_localId_fkey` FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
