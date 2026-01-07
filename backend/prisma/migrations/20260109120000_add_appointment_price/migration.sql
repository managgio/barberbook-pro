-- Add price column with temporary default to backfill existing records
ALTER TABLE `Appointment` ADD COLUMN `price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00;

-- Backfill using current service price when available
UPDATE `Appointment` a
JOIN `Service` s ON s.id = a.serviceId
SET a.price = s.price
WHERE a.price = 0;

-- Remove the default to match Prisma schema
ALTER TABLE `Appointment` MODIFY `price` DECIMAL(10, 2) NOT NULL;
