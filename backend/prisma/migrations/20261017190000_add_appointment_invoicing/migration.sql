CREATE TABLE `InvoiceSequence` (
  `id` VARCHAR(191) NOT NULL,
  `brandId` VARCHAR(191) NOT NULL,
  `year` INTEGER NOT NULL,
  `lastNumber` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `InvoiceSequence_brandId_year_key`(`brandId`, `year`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Invoice` (
  `id` VARCHAR(191) NOT NULL,
  `brandId` VARCHAR(191) NOT NULL,
  `localId` VARCHAR(191) NOT NULL,
  `appointmentId` VARCHAR(191) NOT NULL,
  `number` VARCHAR(191) NOT NULL,
  `sequenceYear` INTEGER NOT NULL,
  `issuedAt` DATETIME(3) NOT NULL,
  `currency` VARCHAR(3) NOT NULL,
  `subtotal` DECIMAL(12, 2) NOT NULL,
  `taxRate` DECIMAL(5, 2) NOT NULL,
  `taxAmount` DECIMAL(12, 2) NOT NULL,
  `total` DECIMAL(12, 2) NOT NULL,
  `sellerName` VARCHAR(191) NOT NULL,
  `sellerTaxId` VARCHAR(191) NOT NULL,
  `sellerAddress` TEXT NOT NULL,
  `sellerEmail` VARCHAR(254) NULL,
  `sellerPhone` VARCHAR(40) NULL,
  `customerName` VARCHAR(191) NOT NULL,
  `customerEmail` VARCHAR(254) NULL,
  `customerPhone` VARCHAR(40) NULL,
  `serviceName` VARCHAR(191) NOT NULL,
  `serviceDate` DATETIME(3) NOT NULL,
  `locationName` VARCHAR(191) NOT NULL,
  `professionalName` VARCHAR(191) NULL,
  `logoUrl` TEXT NULL,
  `primaryColor` VARCHAR(16) NULL,
  `createdByUserId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `Invoice_appointmentId_key`(`appointmentId`),
  UNIQUE INDEX `Invoice_brandId_number_key`(`brandId`, `number`),
  INDEX `Invoice_localId_issuedAt_idx`(`localId`, `issuedAt`),
  INDEX `Invoice_brandId_issuedAt_idx`(`brandId`, `issuedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `InvoiceSequence`
  ADD CONSTRAINT `InvoiceSequence_brandId_fkey`
  FOREIGN KEY (`brandId`) REFERENCES `Brand`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Invoice`
  ADD CONSTRAINT `Invoice_brandId_fkey`
  FOREIGN KEY (`brandId`) REFERENCES `Brand`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `Invoice_localId_fkey`
  FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
