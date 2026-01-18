import { Module } from '@nestjs/common';
import { ClientNotesController } from './client-notes.controller';
import { ClientNotesService } from './client-notes.service';

@Module({
  controllers: [ClientNotesController],
  providers: [ClientNotesService],
})
export class ClientNotesModule {}
