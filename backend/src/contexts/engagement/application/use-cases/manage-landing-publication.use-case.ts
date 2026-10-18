import { RequestContext } from '../../../../shared/application/request-context';
import { TenantConfigReadPort } from '../../../../shared/application/tenant-config-read.port';
import { DomainError } from '../../../../shared/domain/domain-error';
import { LandingPublication, LandingPublicationPort, LandingPublicationSection } from '../../ports/outbound/landing-publication.port';

export class ManageLandingPublicationUseCase {
  constructor(private readonly repository: LandingPublicationPort, private readonly config: TenantConfigReadPort) {}

  private async assertEnabled(section: LandingPublicationSection) {
    const features = (await this.config.getEffectiveConfig()).features;
    if (features?.[section === 'faq' ? 'faqEnabled' : 'galleryEnabled'] !== true) {
      throw new DomainError('Section is disabled.', 'LANDING_SECTION_DISABLED');
    }
  }

  async get(context: RequestContext, section: LandingPublicationSection) {
    await this.assertEnabled(section);
    return this.repository.get(context, section);
  }

  async update(context: RequestContext, section: LandingPublicationSection, publication: LandingPublication) {
    await this.assertEnabled(section);
    return this.repository.update(context, section, publication);
  }
}
