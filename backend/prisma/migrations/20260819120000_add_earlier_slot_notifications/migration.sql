ALTER TABLE `Appointment`
  ADD COLUMN `earlierSlotRequested` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `earlierSlotNotifiedAt` DATETIME(3) NULL,
  ADD COLUMN `earlierSlotCandidateAt` DATETIME(3) NULL;

CREATE INDEX `Appointment_earlier_slot_lookup_idx`
  ON `Appointment`(
    `localId`,
    `barberId`,
    `earlierSlotRequested`,
    `earlierSlotNotifiedAt`,
    `startDateTime`
  );
