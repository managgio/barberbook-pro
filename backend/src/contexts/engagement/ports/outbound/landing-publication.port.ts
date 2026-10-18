import { RequestContext } from '../../../../shared/application/request-context';

export const LANDING_PUBLICATION_PORT = Symbol('LANDING_PUBLICATION_PORT');
export type LandingPublicationSection = 'faq' | 'gallery';
export type LandingPublication = { published: boolean; version: number };
export interface LandingPublicationPort {
  get(context: RequestContext, section: LandingPublicationSection): Promise<LandingPublication>;
  update(context: RequestContext, section: LandingPublicationSection, publication: LandingPublication): Promise<LandingPublication>;
}
