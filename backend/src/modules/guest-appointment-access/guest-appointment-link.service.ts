import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TENANT_BASE_DOMAIN } from '../../tenancy/tenant.constants';
import {
  TENANT_CONTEXT_PORT,
  TenantContextPort,
} from '../../contexts/platform/ports/outbound/tenant-context.port';
import {
  BOOKING_GUEST_APPOINTMENT_ACCESS_TOKEN_PORT,
  GuestAppointmentAccessTokenPort,
} from '../../contexts/booking/ports/outbound/guest-appointment-access-token.port';

export const GUEST_APPOINTMENT_MANAGEMENT_PATH = '/cita';
const LINK_EXPIRATION_AFTER_APPOINTMENT_MS = 48 * 60 * 60 * 1000;

const normalizeHost = (value?: string | null) => {
  const candidate = value?.trim().toLowerCase();
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate.includes('://') ? candidate : `https://${candidate}`);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return null;
    return parsed.host || null;
  } catch {
    return null;
  }
};

const buildOrigin = (host: string) => {
  const hostname = host.split(':')[0];
  const local = hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname === '127.0.0.1';
  return `${local ? 'http' : 'https'}://${host}`;
};

@Injectable()
export class GuestAppointmentLinkService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
    @Inject(BOOKING_GUEST_APPOINTMENT_ACCESS_TOKEN_PORT)
    private readonly tokenPort: GuestAppointmentAccessTokenPort,
  ) {}

  async createManagementUrl(appointmentId: string): Promise<string | null> {
    const context = this.tenantContextPort.getRequestContext();
    const appointment = await this.prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        localId: context.localId,
        userId: null,
        local: { brandId: context.brandId },
      },
      select: {
        startDateTime: true,
        local: {
          select: {
            brand: {
              select: { customDomain: true, subdomain: true },
            },
          },
        },
      },
    });
    if (!appointment) return null;

    return this.createManagementUrlForGuestAppointment({
      appointmentId,
      startDateTime: appointment.startDateTime,
      customDomain: appointment.local.brand.customDomain,
      subdomain: appointment.local.brand.subdomain,
    });
  }

  createManagementUrlForGuestAppointment(params: {
    appointmentId: string;
    startDateTime: Date;
    customDomain?: string | null;
    subdomain: string;
  }): string | null {
    const context = this.tenantContextPort.getRequestContext();
    const token = this.tokenPort.createToken({
      brandId: context.brandId,
      localId: context.localId,
      appointmentId: params.appointmentId,
      expiresAt: new Date(
        params.startDateTime.getTime() + LINK_EXPIRATION_AFTER_APPOINTMENT_MS,
      ),
    });
    if (!token) return null;

    const customHost = normalizeHost(params.customDomain);
    const baseHost = normalizeHost(TENANT_BASE_DOMAIN);
    const tenantHost = baseHost
      ? normalizeHost(`${params.subdomain}.${baseHost}`)
      : null;
    const host = customHost || tenantHost;
    if (!host) return null;
    return `${buildOrigin(host)}${GUEST_APPOINTMENT_MANAGEMENT_PATH}/${encodeURIComponent(token)}`;
  }
}
