-- AlterTable
ALTER TABLE `CashMovement`
  ADD COLUMN `productOperationType` ENUM('purchase', 'sale') NULL;

-- CreateTable
CREATE TABLE `CashMovementProductItem` (
    `id` VARCHAR(191) NOT NULL,
    `movementId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NULL,
    `productNameSnapshot` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unitAmount` DECIMAL(10, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CashMovementProductItem_movementId_idx`(`movementId`),
    INDEX `CashMovementProductItem_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CashMovementProductItem`
  ADD CONSTRAINT `CashMovementProductItem_movementId_fkey`
  FOREIGN KEY (`movementId`) REFERENCES `CashMovement`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashMovementProductItem`
  ADD CONSTRAINT `CashMovementProductItem_productId_fkey`
  FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
