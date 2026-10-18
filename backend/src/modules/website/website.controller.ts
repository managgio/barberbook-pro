import { BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Get, HttpCode, Inject, Param, Put, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, IsString, Matches, MaxLength, ValidateNested } from 'class-validator';
import { AdminEndpoint } from '../../auth/admin.decorator';
import { ManageWebsiteImagesUseCase } from '../../contexts/platform/application/use-cases/manage-website-images.use-case';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../contexts/platform/ports/outbound/tenant-context.port';
import { WEBSITE_MEDIA_PORT, WebsiteMediaPort } from '../../contexts/platform/ports/outbound/website-media.port';
import { rethrowDomainErrorAsHttp } from '../../shared/interfaces/http/rethrow-domain-error-as-http';
import { WebsiteAccessGuard } from './website-access.guard';

export class WebsiteImageSelectionDto {
  @IsOptional() @IsString() @Matches(/^[a-zA-Z0-9_-]{1,128}$/) fileId?: string;
  @IsOptional() @IsString() @MaxLength(2048) existingUrl?: string;
}
export class ReplaceWebsiteImagesDto {
  @IsString() @Matches(/^[a-f0-9]{64}$/) revision!: string;
  @IsArray() @ArrayMaxSize(5) @ValidateNested({ each: true }) @Type(() => WebsiteImageSelectionDto) images!: WebsiteImageSelectionDto[];
}

@Controller('admin/website/images')
@AdminEndpoint()
@UseGuards(WebsiteAccessGuard)
export class WebsiteController {
  private readonly useCase: ManageWebsiteImagesUseCase;
  constructor(@Inject(WEBSITE_MEDIA_PORT) media: WebsiteMediaPort, @Inject(TENANT_CONTEXT_PORT) private readonly context: TenantContextPort) {
    this.useCase = new ManageWebsiteImagesUseCase(media);
  }
  private async execute<T>(action: () => Promise<T>): Promise<T> {
    try { return await action(); } catch (error) {
      rethrowDomainErrorAsHttp(error, {
        WEBSITE_DISABLED: () => new ForbiddenException('WEBSITE_DISABLED'),
        WEBSITE_SECTION_DISABLED: () => new ForbiddenException('WEBSITE_SECTION_DISABLED'),
        WEBSITE_CONFLICT: () => new ConflictException('WEBSITE_CONFLICT'),
        WEBSITE_INVALID: () => new BadRequestException('WEBSITE_INVALID'),
        WEBSITE_INVALID_MEDIA: () => new BadRequestException('WEBSITE_INVALID_MEDIA'),
        WEBSITE_MEDIA_UNAVAILABLE: () => new ServiceUnavailableException('WEBSITE_MEDIA_UNAVAILABLE'),
      });
      throw error;
    }
  }
  @Get() read() { return this.execute(() => this.useCase.read(this.context.getRequestContext())); }
  @Delete('uploads/:fileId') @HttpCode(204) discard(@Param('fileId') fileId: string) {
    return this.execute(() => this.useCase.discard(this.context.getRequestContext(), fileId));
  }
  @Put(':section') replace(@Param('section') section: string, @Body() data: ReplaceWebsiteImagesDto) {
    return this.execute(() => this.useCase.replace(this.context.getRequestContext(), data.revision, section, data.images));
  }
}
