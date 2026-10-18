CREATE TABLE `Faq` (
    `id` VARCHAR(191) NOT NULL,
    `localId` VARCHAR(191) NOT NULL,
    `question` VARCHAR(240) NOT NULL,
    `answer` TEXT NOT NULL,
    `position` INTEGER NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `Faq_localId_position_id_idx` (`localId`, `position`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Faq` ADD CONSTRAINT `Faq_localId_fkey` FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
