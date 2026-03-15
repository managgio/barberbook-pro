-- Create table for localizable source content
CREATE TABLE `LocalizedContent` (
  `id` VARCHAR(191) NOT NULL,
  `scope` ENUM('brand', 'location') NOT NULL DEFAULT 'location',
  `brandId` VARCHAR(191) NOT NULL,
  `localId` VARCHAR(191) NULL,
  `entityType` VARCHAR(64) NOT NULL,
  `entityId` VARCHAR(64) NOT NULL,
  `fieldKey` VARCHAR(64) NOT NULL,
  `sourceLanguage` VARCHAR(10) NOT NULL,
  `sourceText` TEXT NOT NULL,
  `sourceHash` VARCHAR(64) NOT NULL,
  `sourceVersion` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `uq_lc_scope_brand_local_entity_field`(
    `scope`, `brandId`, `localId`, `entityType`, `entityId`, `fieldKey`
  ),
  INDEX `idx_lc_brand_local_entity`(`brandId`, `localId`, `entityType`, `entityId`),
  INDEX `idx_lc_brand_local_field`(`brandId`, `localId`, `fieldKey`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create table for translated values
CREATE TABLE `LocalizedContentTranslation` (
  `id` VARCHAR(191) NOT NULL,
  `contentId` VARCHAR(191) NOT NULL,
  `brandId` VARCHAR(191) NOT NULL,
  `localId` VARCHAR(191) NULL,
  `language` VARCHAR(10) NOT NULL,
  `translatedText` TEXT NOT NULL,
  `status` ENUM('pending', 'ready', 'failed', 'stale') NOT NULL DEFAULT 'pending',
  `source` ENUM('ai', 'manual') NOT NULL DEFAULT 'ai',
  `manualLocked` BOOLEAN NOT NULL DEFAULT FALSE,
  `basedOnSourceVersion` INTEGER NOT NULL DEFAULT 1,
  `provider` VARCHAR(191) NULL,
  `model` VARCHAR(191) NULL,
  `errorMessage` TEXT NULL,
  `lastGeneratedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `uq_lct_content_lang`(`contentId`, `language`),
  INDEX `idx_lct_brand_local_lang_status`(`brandId`, `localId`, `language`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `LocalizedContent`
  ADD CONSTRAINT `LocalizedContent_brandId_fkey`
    FOREIGN KEY (`brandId`) REFERENCES `Brand`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `LocalizedContent_localId_fkey`
    FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `LocalizedContentTranslation`
  ADD CONSTRAINT `LocalizedContentTranslation_contentId_fkey`
    FOREIGN KEY (`contentId`) REFERENCES `LocalizedContent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `LocalizedContentTranslation_brandId_fkey`
    FOREIGN KEY (`brandId`) REFERENCES `Brand`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `LocalizedContentTranslation_localId_fkey`
    FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
