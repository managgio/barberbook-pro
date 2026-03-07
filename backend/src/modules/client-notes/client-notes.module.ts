import { Module } from '@nestjs/common';
import { PrismaClientNoteRepositoryAdapter } from '../../contexts/engagement/infrastructure/prisma/prisma-client-note-repository.adapter';
import { ENGAGEMENT_CLIENT_NOTE_REPOSITORY_PORT } from '../../contexts/engagement/ports/outbound/client-note-repository.port';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { ClientNotesController } from './client-notes.controller';
import { ClientNotesService } from './client-notes.service';

@Module({
  imports: [TenancyModule],
  controllers: [ClientNotesController],
  providers: [
    ClientNotesService,
    PrismaClientNoteRepositoryAdapter,
    {
      provide: ENGAGEMENT_CLIENT_NOTE_REPOSITORY_PORT,
      useExisting: PrismaClientNoteRepositoryAdapter,
    },
  ],
})
export class ClientNotesModule {}
