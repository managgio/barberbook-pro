import { BadRequestException } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ReviewFeedbackStatus } from '@prisma/client';
import { endOfDayInTimeZone, startOfDayInTimeZone } from '../../../utils/timezone';

export class ReviewFeedbackQueryDto {
  @IsOptional()
  @IsEnum(ReviewFeedbackStatus)
  status?: ReviewFeedbackStatus;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(100)
  pageSize = 20;
}

export const parseReviewMetricsRange = (from: string | undefined, to: string | undefined, timezone: string) => {
  const parse = (value: string | undefined, end: boolean) => {
    if (!value) return undefined;
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) throw new BadRequestException('Fecha inválida.');
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      if (date.toISOString().slice(0, 10) !== value) throw new BadRequestException('Fecha inválida.');
      return end ? endOfDayInTimeZone(value, timezone) : startOfDayInTimeZone(value, timezone);
    }
    if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)) throw new BadRequestException('Fecha inválida.');
    return date;
  };
  const range = { from: parse(from, false), to: parse(to, true) };
  if (range.from && range.to && range.from > range.to) throw new BadRequestException('Rango de fechas inválido.');
  return range;
};
