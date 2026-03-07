export const AI_HOLIDAY_TOOL_PORT = Symbol('AI_HOLIDAY_TOOL_PORT');

export interface AiHolidayToolPort {
  getGeneralHolidays(): Promise<Array<{ start: string; end: string }>>;
  addGeneralHoliday(range: { start: string; end: string }): Promise<Array<{ start: string; end: string }>>;
  addBarberHoliday(barberId: string, range: { start: string; end: string }): Promise<Array<{ start: string; end: string }>>;
}
