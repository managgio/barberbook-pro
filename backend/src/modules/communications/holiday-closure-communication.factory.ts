import { BadRequestException } from '@nestjs/common';
import { CreateCommunicationDto } from './dto/create-communication.dto';
import { HolidayClosureActionDto } from './dto/holiday-closure-action.dto';

const MAX_HOLIDAY_RANGE_DAYS = 366;

const assertBoundedRange = (start: string, end: string) => {
  const startDate = new Date(`${start}T00:00:00.000Z`);
  const endDate = new Date(`${end}T00:00:00.000Z`);
  const days = Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
  if (!Number.isFinite(days) || days < 1 || days > MAX_HOLIDAY_RANGE_DAYS) {
    throw new BadRequestException('El rango del festivo debe estar entre 1 y 366 días.');
  }
};

export const buildHolidayClosureCommunication = (
  dto: HolidayClosureActionDto,
): CreateCommunicationDto => {
  if (dto.type === 'barber' && !dto.barberId) {
    throw new BadRequestException('Debes indicar el profesional para este festivo.');
  }
  const start = dto.start <= dto.end ? dto.start : dto.end;
  const end = dto.start <= dto.end ? dto.end : dto.start;
  assertBoundedRange(start, end);

  return {
    actionType: 'comunicar_y_cancelar',
    scopeType: dto.type === 'barber' ? 'professional_single' : 'all_day',
    scopeCriteria: {
      dateFrom: start,
      dateTo: end,
      barberId: dto.type === 'barber' ? dto.barberId : undefined,
    },
    templateKey: 'local_closure',
    channel: 'email',
    title: 'Cierre por festivo',
    subject: 'Tu cita será cancelada por cierre del establecimiento',
    message:
      'El establecimiento permanecerá cerrado en la fecha de tu cita. Tu reserva será cancelada. Por favor, solicita una nueva cita desde nuestra web o contacta con nosotros para ayudarte.',
    internalNote: 'Generado desde el flujo de Festivos.',
    executeNow: true,
    idempotencyKey: dto.idempotencyKey,
    extraOptions: {
      createHoliday: {
        enabled: true,
        type: dto.type,
        start,
        end,
        barberId: dto.type === 'barber' ? dto.barberId : undefined,
      },
    },
  };
};
