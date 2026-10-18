CREATE TABLE `LandingPublication` (
  `localId` VARCHAR(191) NOT NULL,
  `section` VARCHAR(32) NOT NULL,
  `published` BOOLEAN NOT NULL DEFAULT false,
  `version` INTEGER NOT NULL DEFAULT 1,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`localId`, `section`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `GalleryCategory` (
  `id` VARCHAR(191) NOT NULL,
  `localId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(80) NOT NULL,
  `version` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `GalleryCategory_localId_id_key` (`localId`, `id`),
  UNIQUE INDEX `GalleryCategory_localId_name_key` (`localId`, `name`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `GalleryItem` (
  `id` VARCHAR(191) NOT NULL,
  `localId` VARCHAR(191) NOT NULL,
  `categoryId` VARCHAR(191) NOT NULL,
  `title` VARCHAR(120) NOT NULL,
  `description` TEXT NOT NULL,
  `imageUrl` VARCHAR(2048) NOT NULL,
  `imageFileId` VARCHAR(128) NOT NULL,
  `imageWidth` INTEGER NOT NULL,
  `imageHeight` INTEGER NOT NULL,
  `beforeUrl` VARCHAR(2048) NULL,
  `beforeFileId` VARCHAR(128) NULL,
  `beforeWidth` INTEGER NULL,
  `beforeHeight` INTEGER NULL,
  `position` INTEGER NOT NULL,
  `version` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `GalleryItem_localId_position_id_idx` (`localId`, `position`, `id`),
  INDEX `GalleryItem_localId_categoryId_idx` (`localId`, `categoryId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `LandingPublication` ADD CONSTRAINT `LandingPublication_localId_fkey` FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `GalleryCategory` ADD CONSTRAINT `GalleryCategory_localId_fkey` FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `GalleryItem` ADD CONSTRAINT `GalleryItem_localId_fkey` FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `GalleryItem` ADD CONSTRAINT `GalleryItem_localId_categoryId_fkey` FOREIGN KEY (`localId`, `categoryId`) REFERENCES `GalleryCategory`(`localId`, `id`) ON DELETE CASCADE ON UPDATE CASCADE;
