import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { LocalizationController } from './localization.controller';
import { LocalizationSchedulerService } from './localization.scheduler';
import { LocalizationService } from './localization.service';
import { OpenAiTranslationProviderAdapter } from './providers/openai-translation-provider.adapter';
import { TRANSLATION_PROVIDER_PORT } from './providers/translation-provider.port';

@Global()
@Module({
  imports: [PrismaModule, TenancyModule],
  controllers: [LocalizationController],
  providers: [
    LocalizationService,
    LocalizationSchedulerService,
    OpenAiTranslationProviderAdapter,
    { provide: TRANSLATION_PROVIDER_PORT, useExisting: OpenAiTranslationProviderAdapter },
  ],
  exports: [LocalizationService],
})
export class LocalizationModule {}
