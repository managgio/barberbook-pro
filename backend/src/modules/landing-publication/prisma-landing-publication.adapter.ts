import { Injectable } from '@nestjs/common';
import { LandingPublication, LandingPublicationPort, LandingPublicationSection } from '../../contexts/engagement/ports/outbound/landing-publication.port';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContext } from '../../shared/application/request-context';
import { DomainError } from '../../shared/domain/domain-error';

@Injectable()
export class PrismaLandingPublicationAdapter implements LandingPublicationPort {
  constructor(private readonly prisma: PrismaService) {}

  async get(context: RequestContext, section: LandingPublicationSection) {
    return await this.prisma.landingPublication.findUnique({
      where: { localId_section: { localId: context.localId, section } }, select: { published: true, version: true },
    }) ?? { published: section === 'faq', version: 0 };
  }

  update(context: RequestContext, section: LandingPublicationSection, publication: LandingPublication) {
    return this.prisma.$transaction(async (tx) => {
      const locations = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM Location WHERE id = ${context.localId} AND brandId = ${context.brandId} FOR UPDATE
      `;
      if (locations.length !== 1) throw new DomainError('Location not found.', 'LANDING_SECTION_NOT_FOUND');
      const where = { localId_section: { localId: context.localId, section } };
      const current = await tx.landingPublication.findUnique({ where });
      if ((current?.version ?? 0) !== publication.version) throw new DomainError('Publication changed.', 'LANDING_SECTION_CONFLICT');
      return tx.landingPublication.upsert({
        where, create: { localId: context.localId, section, published: publication.published },
        update: { published: publication.published, version: { increment: 1 } },
        select: { published: true, version: true },
      });
    });
  }
}
