import { Injectable } from '@nestjs/common';
import { App, getApp, getApps, initializeApp, cert } from 'firebase-admin/app';
import { DecodedIdToken, getAuth } from 'firebase-admin/auth';
import { TenantConfigService } from '../../tenancy/tenant-config.service';
import { getCurrentBrandId } from '../../tenancy/tenant.context';

@Injectable()
export class FirebaseAdminService {
  private readonly appCache = new Map<string, App>();
  private readonly appInitCache = new Map<string, Promise<App | null>>();

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

    if (this.appInitCache.has(brandId)) {
      return this.appInitCache.get(brandId) || null;
    }

    const initPromise = (async () => {
      const config = await this.tenantConfig.getBrandConfig(brandId);
      const firebase = config.firebaseAdmin;
      if (!firebase?.projectId || !firebase.clientEmail || !firebase.privateKey) {
        return null;
      }

      try {
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
      } catch (error) {
        if ((error as Error)?.message?.includes('already exists')) {
          const existing = getApp(brandId);
          this.appCache.set(brandId, existing);
          return existing;
        }
        throw error;
      }
    })();

    this.appInitCache.set(brandId, initPromise);
    try {
      return await initPromise;
    } finally {
      this.appInitCache.delete(brandId);
    }
  }

  async deleteUser(firebaseUid: string) {
    const brandId = getCurrentBrandId();
    const app = await this.getOrCreateApp(brandId);
    if (!app) return null;
    const auth = getAuth(app);
    await auth.deleteUser(firebaseUid);
    return true;
  }

  async verifyIdToken(idToken: string): Promise<DecodedIdToken | null> {
    const brandId = getCurrentBrandId();
    const app = await this.getOrCreateApp(brandId);
    if (!app) return null;
    const auth = getAuth(app);
    try {
      return await auth.verifyIdToken(idToken);
    } catch {
      return null;
    }
  }
}
