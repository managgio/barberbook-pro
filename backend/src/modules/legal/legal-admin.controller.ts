import { Body, Controller, ForbiddenException, Get, Put, Req } from '@nestjs/common';
import { AdminEndpoint } from '../../auth/admin.decorator';
import { TenantConfigService } from '../../tenancy/tenant-config.service';
import { UpdateInvoiceLegalSettingsDto } from './dto/update-invoice-legal-settings.dto';
import { LegalService } from './legal.service';

const toInvoiceLegalSettings = (settings: Awaited<ReturnType<LegalService['getSettings']>>) => ({
  legalOwnerName: settings.ownerName,
  legalOwnerTaxId: settings.taxId,
  legalOwnerAddress: settings.address,
  legalContactEmail: settings.contactEmail,
  legalContactPhone: settings.contactPhone,
  country: settings.country,
  updatedAt: settings.updatedAt,
});

@Controller('admin/invoicing')
export class LegalAdminController {
  constructor(
    private readonly legalService: LegalService,
    private readonly tenantConfigService: TenantConfigService,
  ) {}

  private async assertInvoicingEnabled() {
    const config = await this.tenantConfigService.getBrandConfig();
    if (config.invoicing?.enabled !== true) {
      throw new ForbiddenException('La facturación no está habilitada para este tenant.');
    }
  }

  @Get('settings')
  @AdminEndpoint()
  async getInvoiceSettings() {
    await this.assertInvoicingEnabled();
    return toInvoiceLegalSettings(await this.legalService.getSettings());
  }

  @Put('settings')
  @AdminEndpoint()
  async updateInvoiceSettings(
    @Body() data: UpdateInvoiceLegalSettingsDto,
    @Req() req: { adminUserId?: string },
  ) {
    await this.assertInvoicingEnabled();
    return toInvoiceLegalSettings(
      await this.legalService.updateSettings(undefined, data, req.adminUserId),
    );
  }
}
