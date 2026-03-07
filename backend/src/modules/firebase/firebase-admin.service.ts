import { Inject, Injectable } from '@nestjs/common';
import { App, getApp, getApps, initializeApp, cert } from 'firebase-admin/app';
import { DecodedIdToken, getAuth } from 'firebase-admin/auth';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../contexts/platform/ports/outbound/tenant-context.port';
import { TENANT_CONFIG_READ_PORT, TenantConfigReadPort } from '../../shared/application/tenant-config-read.port';

@Injectable()
export class FirebaseAdminService {
  private readonly appCache = new Map<string, App>();
  private readonly appInitCache = new Map<string, Promise<App | null>>();
  private readonly devAuthBypassEnabled =
    process.env.AUTH_DEV_BYPASS_ENABLED === 'true' &&
    (process.env.NODE_ENV || 'development').toLowerCase() !== 'production';
  private readonly devAuthBypassPrefix = process.env.AUTH_DEV_BYPASS_PREFIX || 'dev:';

  constructor(
    @Inject(TENANT_CONFIG_READ_PORT)
    private readonly tenantConfigReadPort: TenantConfigReadPort,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
  ) {}

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
      const config = await this.tenantConfigReadPort.getBrandConfig(brandId);
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
    const brandId = this.tenantContextPort.getRequestContext().brandId;
    const app = await this.getOrCreateApp(brandId);
    if (!app) return null;
    const auth = getAuth(app);
    await auth.deleteUser(firebaseUid);
    return true;
  }

  async verifyIdToken(idToken: string): Promise<DecodedIdToken | null> {
    const devBypassToken = this.resolveDevBypassToken(idToken);
    if (devBypassToken) return devBypassToken;

    const brandId = this.tenantContextPort.getRequestContext().brandId;
    const app = await this.getOrCreateApp(brandId);
    if (!app) return null;
    const auth = getAuth(app);
    try {
      return await auth.verifyIdToken(idToken);
    } catch {
      return null;
    }
  }

  private resolveDevBypassToken(idToken: string): DecodedIdToken | null {
    if (!this.devAuthBypassEnabled) return null;
    if (!idToken.startsWith(this.devAuthBypassPrefix)) return null;
    const uid = idToken.slice(this.devAuthBypassPrefix.length).trim();
    if (!uid) return null;
    const now = Math.floor(Date.now() / 1000);
    return {
      uid,
      sub: uid,
      aud: 'local-dev-bypass',
      iss: 'https://local.dev/auth',
      iat: now,
      exp: now + 3600,
      auth_time: now,
      firebase: {
        identities: {},
        sign_in_provider: 'custom',
      },
    } as DecodedIdToken;
  }
}
