ALTER TABLE `Appointment`
  ADD COLUMN `reminderSmsRequested` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `reminderWhatsappRequested` BOOLEAN NOT NULL DEFAULT false;
