-- AlterTable
ALTER TABLE `Appointment` MODIFY `status` ENUM('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show') NOT NULL DEFAULT 'scheduled';
