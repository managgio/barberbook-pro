import { LandingPublicationPort } from '../../ports/outbound/landing-publication.port';
import { RequestContext } from '../../../../shared/application/request-context';
import { TenantConfigReadPort } from '../../../../shared/application/tenant-config-read.port';
import { DomainError } from '../../../../shared/domain/domain-error';
import { FaqContent, normalizeFaqContent } from '../../domain/services/faq-policy';
import { FaqRepositoryPort } from '../../ports/outbound/faq-repository.port';

export class ManageFaqsUseCase {
  constructor(private readonly repository: FaqRepositoryPort, private readonly config: TenantConfigReadPort, private readonly publication: LandingPublicationPort) {}

  private async isEnabled() {
    return (await this.config.getEffectiveConfig()).features?.faqEnabled === true;
  }

  private async assertEnabled() {
    if (!(await this.isEnabled())) throw new DomainError('FAQ is disabled.', 'FAQ_DISABLED');
  }

  async list(context: RequestContext, administrative = false) {
    if (!(await this.isEnabled())) {
      if (administrative) throw new DomainError('FAQ is disabled.', 'FAQ_DISABLED');
      return [];
    }
    if (!administrative && !(await this.publication.get(context, 'faq')).published) return [];
    return this.repository.list(context);
  }

  async create(context: RequestContext, content: FaqContent) {
    await this.assertEnabled();
    return this.repository.create(context, normalizeFaqContent(content));
  }

  async update(context: RequestContext, id: string, version: number, content: FaqContent) {
    await this.assertEnabled();
    return this.repository.update(context, id, version, normalizeFaqContent(content));
  }

  async remove(context: RequestContext, id: string, version: number) {
    await this.assertEnabled();
    return this.repository.remove(context, id, version);
  }

  async reorder(context: RequestContext, expectedIds: string[], orderedIds: string[]) {
    await this.assertEnabled();
    return this.repository.reorder(context, expectedIds, orderedIds);
  }
}
