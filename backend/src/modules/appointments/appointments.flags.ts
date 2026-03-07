export type BookingExecutionMode = 'v2';

const FINAL_EXECUTION_MODE: BookingExecutionMode = 'v2';

export const getBookingAvailabilitySingleMode = (): BookingExecutionMode => FINAL_EXECUTION_MODE;
export const getBookingAvailabilityBatchMode = (): BookingExecutionMode => FINAL_EXECUTION_MODE;
export const getBookingWeeklyLoadMode = (): BookingExecutionMode => FINAL_EXECUTION_MODE;
export const getBookingCreateMode = (): BookingExecutionMode => FINAL_EXECUTION_MODE;
export const getBookingUpdateMode = (): BookingExecutionMode => FINAL_EXECUTION_MODE;
export const getBookingRemoveMode = (): BookingExecutionMode => FINAL_EXECUTION_MODE;
