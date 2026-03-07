import { Injectable } from '@nestjs/common';
import { ClockPort } from '../../application/clock.port';

@Injectable()
export class SystemClockAdapter implements ClockPort {
  now(): Date {
    return new Date();
  }
}
