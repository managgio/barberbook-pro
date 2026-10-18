ALTER TABLE `Appointment`
  ADD COLUMN `totalDurationMinutes` INTEGER NOT NULL DEFAULT 30 AFTER `serviceNameSnapshot`;

UPDATE `Appointment` AS `appointment`
INNER JOIN `Service` AS `service` ON `service`.`id` = `appointment`.`serviceId`
SET `appointment`.`totalDurationMinutes` = `service`.`duration`;

CREATE TABLE `AppointmentServiceItem` (
  `id` VARCHAR(191) NOT NULL,
  `appointmentId` VARCHAR(191) NOT NULL,
  `localId` VARCHAR(191) NOT NULL,
  `serviceId` VARCHAR(191) NOT NULL,
  `position` INTEGER NOT NULL DEFAULT 0,
  `nameSnapshot` VARCHAR(191) NOT NULL,
  `durationMinutes` INTEGER NOT NULL,
  `unitPrice` DECIMAL(10, 2) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `AppointmentServiceItem_appointmentId_serviceId_key`(`appointmentId`, `serviceId`),
  INDEX `AppointmentServiceItem_localId_appointmentId_idx`(`localId`, `appointmentId`),
  INDEX `AppointmentServiceItem_localId_serviceId_idx`(`localId`, `serviceId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `AppointmentServiceItem` (
  `id`,
  `appointmentId`,
  `localId`,
  `serviceId`,
  `position`,
  `nameSnapshot`,
  `durationMinutes`,
  `unitPrice`,
  `createdAt`
)
SELECT
  CONCAT('asi_', REPLACE(UUID(), '-', '')),
  `appointment`.`id`,
  `appointment`.`localId`,
  `appointment`.`serviceId`,
  0,
  COALESCE(`appointment`.`serviceNameSnapshot`, `service`.`name`),
  `service`.`duration`,
  `service`.`price`,
  `appointment`.`createdAt`
FROM `Appointment` AS `appointment`
INNER JOIN `Service` AS `service` ON `service`.`id` = `appointment`.`serviceId`;

ALTER TABLE `AppointmentServiceItem`
  ADD CONSTRAINT `AppointmentServiceItem_appointmentId_fkey`
    FOREIGN KEY (`appointmentId`) REFERENCES `Appointment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `AppointmentServiceItem_localId_fkey`
    FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `AppointmentServiceItem_serviceId_fkey`
    FOREIGN KEY (`serviceId`) REFERENCES `Service`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ai_chat_messages`
  ADD COLUMN `input_source` ENUM('typed', 'voice', 'template') NULL AFTER `content`,
  ADD COLUMN `template_key` VARCHAR(64) NULL AFTER `input_source`,
  ADD INDEX `ai_chat_messages_local_id_input_source_created_at_idx` (`local_id`, `input_source`, `created_at`);
