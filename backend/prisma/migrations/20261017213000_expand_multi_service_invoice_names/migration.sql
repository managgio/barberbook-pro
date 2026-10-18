ALTER TABLE `Appointment`
  MODIFY COLUMN `serviceNameSnapshot` TEXT NULL;

ALTER TABLE `Invoice`
  MODIFY COLUMN `serviceName` TEXT NOT NULL;
