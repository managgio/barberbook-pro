CREATE TABLE `WebsiteMediaDeletion` (
    `id` VARCHAR(191) NOT NULL,
    `brandId` VARCHAR(191) NOT NULL,
    `fileId` VARCHAR(128) NOT NULL,
    `url` VARCHAR(2048) NOT NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'pending',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `nextAttempt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `WebsiteMediaDeletion_brandId_fileId_key`(`brandId`, `fileId`),
    INDEX `WebsiteMediaDeletion_status_nextAttempt_idx`(`status`, `nextAttempt`),
    PRIMARY KEY (`id`),
    CONSTRAINT `WebsiteMediaDeletion_brandId_fkey` FOREIGN KEY (`brandId`) REFERENCES `Brand` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
