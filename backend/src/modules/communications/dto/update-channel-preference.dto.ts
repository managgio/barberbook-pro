import { IsIn } from 'class-validator';
import { COMMUNICATION_CHANNELS } from '../communications.constants';

export class UpdateChannelPreferenceDto {
  @IsIn(COMMUNICATION_CHANNELS)
  channel!: (typeof COMMUNICATION_CHANNELS)[number];
}
