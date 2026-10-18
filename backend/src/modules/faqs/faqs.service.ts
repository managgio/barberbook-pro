import { LANDING_PUBLICATION_PORT, LandingPublicationPort } from '../../contexts/engagement/ports/outbound/landing-publication.port';
import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ManageFaqsUseCase } from '../../contexts/engagement/application/use-cases/manage-faqs.use-case';
import { FAQ_REPOSITORY_PORT, Faq, FaqRepositoryPort } from '../../contexts/engagement/ports/outbound/faq-repository.port';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../contexts/platform/ports/outbound/tenant-context.port';
import { TENANT_CONFIG_READ_PORT, TenantConfigReadPort } from '../../shared/application/tenant-config-read.port';
import { rethrowDomainErrorAsHttp } from '../../shared/interfaces/http/rethrow-domain-error-as-http';
import { LocalizationService } from '../localization/localization.service';
import { CreateFaqDto, ReorderFaqsDto, UpdateFaqDto } from './dto/faq.dto';

@Injectable()
export class FaqsService {
  private readonly useCase: ManageFaqsUseCase;
  constructor(
    @Inject(FAQ_REPOSITORY_PORT) repository: FaqRepositoryPort,
    @Inject(TENANT_CONFIG_READ_PORT) config: TenantConfigReadPort,
    @Inject(TENANT_CONTEXT_PORT) private readonly context: TenantContextPort,
    private readonly localization: LocalizationService,
    @Inject(LANDING_PUBLICATION_PORT) publication: LandingPublicationPort,
  ) { this.useCase = new ManageFaqsUseCase(repository, config, publication); }

  private async execute<T>(action: () => Promise<T>): Promise<T> {
    try { return await action(); } catch (error) {
      rethrowDomainErrorAsHttp(error, {
        FAQ_DISABLED: () => new ForbiddenException('FAQ_DISABLED'),
        FAQ_NOT_FOUND: () => new NotFoundException('FAQ_NOT_FOUND'),
        FAQ_CONFLICT: () => new ConflictException('FAQ_CONFLICT'),
        FAQ_INVALID: () => new BadRequestException('FAQ_INVALID'),
        FAQ_LIMIT: () => new BadRequestException('FAQ_LIMIT'),
      });
      throw error;
    }
  }

  list(administrative = false) {
    return this.execute(async () => {
      const context = this.context.getRequestContext();
      const faqs = await this.useCase.list(context, administrative);
      if (administrative || !faqs.length) return faqs;
      const { items } = await this.localization.localizeCollection({
        context, entityType: 'faq', items: faqs, syncMissingSources: false,
        descriptors: (['question', 'answer'] as const).map((fieldKey) => ({
          fieldKey, getValue: (item: Faq) => item[fieldKey], setValue: (item: Faq, value: string) => { item[fieldKey] = value; },
        })),
      });
      return items;
    });
  }

  create(data: CreateFaqDto) {
    return this.execute(() => this.useCase.create(this.context.getRequestContext(), data));
  }
  update(id: string, data: UpdateFaqDto) {
    return this.execute(() => this.useCase.update(this.context.getRequestContext(), id, data.version, data));
  }
  remove(id: string, version: number) {
    return this.execute(() => this.useCase.remove(this.context.getRequestContext(), id, version));
  }
  reorder(data: ReorderFaqsDto) {
    return this.execute(() => this.useCase.reorder(this.context.getRequestContext(), data.expectedIds, data.orderedIds));
  }
}
