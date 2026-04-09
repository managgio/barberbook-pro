ALTER TABLE `CommunicationCampaign`
  MODIFY `scopeType` ENUM(
    'all_day',
    'appointments_morning',
    'appointments_afternoon',
    'day_time_range',
    'professional_single',
    'professional_multi',
    'appointment_selection',
    'all_clients'
  ) NOT NULL;
