import { Injectable } from '@nestjs/common';
import { App, getApp, getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { TenantConfigService } from '../../tenancy/tenant-config.service';
import { getCurrentBrandId } from '../../tenancy/tenant.context';

@Injectable()
export class FirebaseAdminService {
  private readonly appCache = new Map<string, App>();

  constructor(private readonly tenantConfig: TenantConfigService) {}

  private async getOrCreateApp(brandId: string) {
    if (this.appCache.has(brandId)) {
      return this.appCache.get(brandId) || null;
    }

    if (getApps().some((app) => app.name === brandId)) {
      const app = getApp(brandId);
      this.appCache.set(brandId, app);
      return app;
    }

    const config = await this.tenantConfig.getBrandConfig(brandId);
    const firebase = config.firebaseAdmin;
    if (!firebase?.projectId || !firebase.clientEmail || !firebase.privateKey) {
      return null;
    }

    const app = initializeApp(
      {
        credential: cert({
          projectId: firebase.projectId,
          clientEmail: firebase.clientEmail,
          privateKey: firebase.privateKey.replace(/\\n/g, '\n'),
        }),
      },
      brandId,
    );
    this.appCache.set(brandId, app);
    return app;
  }

  async deleteUser(firebaseUid: string) {
    const brandId = getCurrentBrandId();
    const app = await this.getOrCreateApp(brandId);
    if (!app) return null;
    const auth = getAuth(app);
    await auth.deleteUser(firebaseUid);
    return true;
  }
}
