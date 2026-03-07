import { Inject, Injectable } from '@nestjs/common';
import { AiTenantConfigPort } from '../../ports/outbound/ai-tenant-config.port';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../../platform/ports/outbound/tenant-context.port';
import { TenantConfigService } from '../../../../tenancy/tenant-config.service';

@Injectable()
export class TenantConfigAiTenantConfigAdapter implements AiTenantConfigPort {
  constructor(
    private readonly tenantConfigService: TenantConfigService,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
  ) {}

  async isAlertsEnabled(): Promise<boolean> {
    const config = await this.tenantConfigService.getPublicConfig();
    const hidden = config?.adminSidebar?.hiddenSections || [];
    return !hidden.includes('alerts');
  }

  async getChatConfig() {
    const config = await this.tenantConfigService.getBrandConfig(
      this.tenantContextPort.getRequestContext().brandId,
    );
    const rawMaxTokens = config.ai?.maxTokens ?? 800;
    const rawTemperature = config.ai?.temperature ?? 0.3;
    const maxTokens = typeof rawMaxTokens === 'string' ? Number(rawMaxTokens) : rawMaxTokens;
    const temperature = typeof rawTemperature === 'string' ? Number(rawTemperature) : rawTemperature;
    return {
      provider: config.ai?.provider || 'openai',
      apiKey: config.ai?.apiKey || null,
      model: config.ai?.model || 'gpt-4o-mini',
      maxTokens: Number.isFinite(maxTokens) ? maxTokens : 800,
      temperature: Number.isFinite(temperature) ? temperature : 0.3,
    };
  }

  async getTranscriptionConfig() {
    const config = await this.tenantConfigService.getBrandConfig(
      this.tenantContextPort.getRequestContext().brandId,
    );
    return {
      provider: config.ai?.provider || 'openai',
      apiKey: config.ai?.apiKey || null,
      model: config.ai?.transcriptionModel || 'whisper-1',
      language: 'es',
      temperature: 0,
    };
  }
}
