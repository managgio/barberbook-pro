-- CreateTable
CREATE TABLE `web_vital_events` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `brandId` VARCHAR(191) NOT NULL,
  `localId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(12) NOT NULL,
  `value` DOUBLE NOT NULL,
  `rating` VARCHAR(24) NOT NULL,
  `path` VARCHAR(300) NOT NULL,
  `timestamp` DATETIME(3) NOT NULL,
  `userAgent` VARCHAR(200) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `api_metric_events` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `brandId` VARCHAR(191) NOT NULL,
  `localId` VARCHAR(191) NOT NULL,
  `subdomain` VARCHAR(80) NULL,
  `method` VARCHAR(12) NOT NULL,
  `route` VARCHAR(220) NOT NULL,
  `statusCode` INTEGER NOT NULL,
  `durationMs` DOUBLE NOT NULL,
  `timestamp` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `distributed_locks` (
  `lockKey` VARCHAR(120) NOT NULL,
  `ownerId` VARCHAR(80) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`lockKey`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `web_vital_events_timestamp_idx` ON `web_vital_events`(`timestamp`);

-- CreateIndex
CREATE INDEX `web_vital_events_brandId_localId_timestamp_idx` ON `web_vital_events`(`brandId`, `localId`, `timestamp`);

-- CreateIndex
CREATE INDEX `web_vital_events_name_timestamp_idx` ON `web_vital_events`(`name`, `timestamp`);

-- CreateIndex
CREATE INDEX `web_vital_events_rating_timestamp_idx` ON `web_vital_events`(`rating`, `timestamp`);

-- CreateIndex
CREATE INDEX `api_metric_events_timestamp_idx` ON `api_metric_events`(`timestamp`);

-- CreateIndex
CREATE INDEX `api_metric_events_brandId_localId_method_route_timestamp_idx` ON `api_metric_events`(`brandId`, `localId`, `method`, `route`, `timestamp`);

-- CreateIndex
CREATE INDEX `api_metric_events_statusCode_timestamp_idx` ON `api_metric_events`(`statusCode`, `timestamp`);

-- CreateIndex
CREATE INDEX `api_metric_events_subdomain_timestamp_idx` ON `api_metric_events`(`subdomain`, `timestamp`);

-- CreateIndex
CREATE INDEX `distributed_locks_expiresAt_idx` ON `distributed_locks`(`expiresAt`);
