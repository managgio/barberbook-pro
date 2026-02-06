-- CreateIndex
CREATE INDEX `Appointment_localId_startDateTime_idx` ON `Appointment`(`localId`, `startDateTime`);

-- CreateIndex
CREATE INDEX `Appointment_localId_barberId_startDateTime_idx` ON `Appointment`(`localId`, `barberId`, `startDateTime`);

-- CreateIndex
CREATE INDEX `Appointment_localId_userId_startDateTime_idx` ON `Appointment`(`localId`, `userId`, `startDateTime`);

-- CreateIndex
CREATE INDEX `Appointment_localId_status_startDateTime_idx` ON `Appointment`(`localId`, `status`, `startDateTime`);
