import { apiRequest } from './request';

export type LandingPublicationSection = 'faq' | 'gallery';
export type LandingPublication = { published: boolean; version: number };
export const getLandingPublication = (section: LandingPublicationSection, signal?: AbortSignal) =>
  apiRequest<LandingPublication>(`/admin/landing-sections/${section}`, { signal });
export const updateLandingPublication = (section: LandingPublicationSection, publication: LandingPublication) =>
  apiRequest<LandingPublication>(`/admin/landing-sections/${section}`, { method: 'PATCH', body: publication });
