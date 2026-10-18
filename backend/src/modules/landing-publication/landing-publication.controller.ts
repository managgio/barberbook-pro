import { UseGuards } from '@nestjs/common';
import { WebsiteAccessGuard } from '../website/website-access.guard';
import { Body, Controller, Get, Inject, Param, Patch, BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { IsBoolean, IsInt, Min } from 'class-validator';
import { AdminEndpoint } from '../../auth/admin.decorator';
import { ManageLandingPublicationUseCase } from '../../contexts/engagement/application/use-cases/manage-landing-publication.use-case';
import { LANDING_PUBLICATION_PORT, LandingPublicationPort, LandingPublicationSection } from '../../contexts/engagement/ports/outbound/landing-publication.port';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../contexts/platform/ports/outbound/tenant-context.port';
import { TENANT_CONFIG_READ_PORT, TenantConfigReadPort } from '../../shared/application/tenant-config-read.port';
import { rethrowDomainErrorAsHttp } from '../../shared/interfaces/http/rethrow-domain-error-as-http';

export class UpdateLandingPublicationDto {
  @IsBoolean() published!: boolean;
  @IsInt() @Min(0) version!: number;
}

@Controller('admin/landing-sections')
@AdminEndpoint()
@UseGuards(WebsiteAccessGuard)
export class LandingPublicationController {
  private readonly useCase: ManageLandingPublicationUseCase;
  constructor(
    @Inject(LANDING_PUBLICATION_PORT) repository: LandingPublicationPort,
    @Inject(TENANT_CONFIG_READ_PORT) config: TenantConfigReadPort,
    @Inject(TENANT_CONTEXT_PORT) private readonly context: TenantContextPort,
  ) { this.useCase = new ManageLandingPublicationUseCase(repository, config); }

  private async execute<T>(section: string, action: (section: LandingPublicationSection) => Promise<T>) {
    if (section !== 'faq' && section !== 'gallery') throw new BadRequestException('INVALID_LANDING_SECTION');
    try { return await action(section); } catch (error) {
      rethrowDomainErrorAsHttp(error, {
        LANDING_SECTION_DISABLED: () => new ForbiddenException('LANDING_SECTION_DISABLED'),
        LANDING_SECTION_CONFLICT: () => new ConflictException('LANDING_SECTION_CONFLICT'),
        LANDING_SECTION_NOT_FOUND: () => new NotFoundException('LANDING_SECTION_NOT_FOUND'),
      });
      throw error;
    }
  }

  @Get(':section')
  get(@Param('section') section: string) { return this.execute(section, (key) => this.useCase.get(this.context.getRequestContext(), key)); }
  @Patch(':section')
  update(@Param('section') section: string, @Body() data: UpdateLandingPublicationDto) {
    return this.execute(section, (key) => this.useCase.update(this.context.getRequestContext(), key, data));
  }
}
