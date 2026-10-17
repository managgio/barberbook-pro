import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Invoice, Prisma } from '@prisma/client';
import { CommerceAppointmentInvoice } from '../../domain/entities/appointment-invoice.entity';
import {
  buildInvoiceNumber,
  calculateInvoiceTotals,
  resolveInvoicingSettings,
} from '../../domain/services/invoice-policy';
import { CommerceAppointmentInvoicePort } from '../../ports/outbound/appointment-invoice.port';
import { PrismaService } from '../../../../prisma/prisma.service';
import { TenantConfigService } from '../../../../tenancy/tenant-config.service';
import { formatDateInTimeZone } from '../../../../utils/timezone';
import { parseGuestContact } from '../../../../shared/domain/guest-contact';

const MAX_TRANSACTION_ATTEMPTS = 3;

@Injectable()
export class PrismaAppointmentInvoiceAdapter implements CommerceAppointmentInvoicePort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantConfig: TenantConfigService,
  ) {}

  async issueForAppointment(params: {
    brandId: string;
    localId: string;
    timezone: string;
    appointmentId: string;
    actorUserId: string | null;
  }): Promise<CommerceAppointmentInvoice> {
    const config = await this.tenantConfig.getEffectiveConfig();
    const settings = resolveInvoicingSettings(config.invoicing);
    if (!settings.enabled) {
      throw new ForbiddenException('La facturación no está activada para este tenant.');
    }

    const existing = await this.prisma.invoice.findFirst({
      where: { appointmentId: params.appointmentId, localId: params.localId },
    });
    if (existing) return this.mapInvoice(existing);

    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        const invoice = await this.prisma.$transaction(async (tx) => {
          const current = await tx.invoice.findFirst({
            where: { appointmentId: params.appointmentId, localId: params.localId },
          });
          if (current) return current;

          const appointment = await tx.appointment.findFirst({
            where: { id: params.appointmentId, localId: params.localId },
            include: {
              user: { select: { name: true, email: true, phone: true } },
              service: { select: { name: true } },
              barber: { select: { name: true } },
              local: { select: { name: true, brandId: true } },
            },
          });
          if (!appointment || appointment.local.brandId !== params.brandId) {
            throw new NotFoundException('Cita no encontrada.');
          }
          if (appointment.status === 'cancelled' || appointment.status === 'no_show') {
            throw new BadRequestException('No se puede facturar una cita cancelada o marcada como no presentada.');
          }

          const [legal, brand] = await Promise.all([
            tx.brandLegalSettings.findUnique({ where: { brandId: params.brandId } }),
            tx.brand.findUnique({ where: { id: params.brandId }, select: { name: true } }),
          ]);
          const sellerName = legal?.legalOwnerName?.trim() || brand?.name?.trim() || '';
          const sellerTaxId = legal?.legalOwnerTaxId?.trim() || '';
          const sellerAddress = legal?.legalOwnerAddress?.trim() || '';
          if (!sellerName || !sellerTaxId || !sellerAddress) {
            throw new BadRequestException(
              'Completa el nombre legal, NIF/CIF y dirección del tenant antes de generar facturas.',
            );
          }

          const guestContact = parseGuestContact(appointment);
          const customerName = appointment.user?.name?.trim() || appointment.guestName?.trim() || '';
          if (!customerName) {
            throw new BadRequestException('La cita no tiene un nombre de cliente válido para facturar.');
          }

          const issuedAt = new Date();
          const year = Number(formatDateInTimeZone(issuedAt, params.timezone).slice(0, 4));
          const sequence = await tx.invoiceSequence.upsert({
            where: { brandId_year: { brandId: params.brandId, year } },
            create: { brandId: params.brandId, year, lastNumber: 1 },
            update: { lastNumber: { increment: 1 } },
          });
          const totals = calculateInvoiceTotals(Number(appointment.price), settings.taxRate);
          const logoUrl = this.resolveLogoUrl(config);

          return tx.invoice.create({
            data: {
              brandId: params.brandId,
              localId: params.localId,
              appointmentId: appointment.id,
              number: buildInvoiceNumber(settings.seriesPrefix, year, sequence.lastNumber),
              sequenceYear: year,
              issuedAt,
              currency: settings.currency,
              subtotal: new Prisma.Decimal(totals.subtotal),
              taxRate: new Prisma.Decimal(totals.taxRate),
              taxAmount: new Prisma.Decimal(totals.taxAmount),
              total: new Prisma.Decimal(totals.total),
              sellerName,
              sellerTaxId,
              sellerAddress,
              sellerEmail: legal?.legalContactEmail?.trim() || null,
              sellerPhone: legal?.legalContactPhone?.trim() || null,
              customerName,
              customerEmail: appointment.user?.email?.trim().toLowerCase() || guestContact.email,
              customerPhone: appointment.user?.phone?.trim() || guestContact.phone,
              serviceName:
                appointment.serviceNameSnapshot?.trim()
                || appointment.service?.name?.trim()
                || 'Servicio',
              serviceDate: appointment.startDateTime,
              locationName: appointment.local.name,
              professionalName:
                appointment.barberNameSnapshot?.trim()
                || appointment.barber?.name?.trim()
                || null,
              logoUrl,
              primaryColor: config.theme?.primary?.trim() || null,
              createdByUserId: params.actorUserId,
            },
          });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

        return this.mapInvoice(invoice);
      } catch (error) {
        if (this.isUniqueConflict(error)) {
          const concurrentInvoice = await this.prisma.invoice.findFirst({
            where: { appointmentId: params.appointmentId, localId: params.localId },
          });
          if (concurrentInvoice) return this.mapInvoice(concurrentInvoice);
          if (attempt < MAX_TRANSACTION_ATTEMPTS) continue;
        }
        if (this.isTransactionConflict(error) && attempt < MAX_TRANSACTION_ATTEMPTS) continue;
        throw error;
      }
    }

    throw new ServiceUnavailableException('No se pudo emitir la factura. Inténtalo de nuevo.');
  }

  private resolveLogoUrl(config: Awaited<ReturnType<TenantConfigService['getEffectiveConfig']>>) {
    const raw = config.theme?.mode === 'dark'
      ? config.branding?.logoDarkUrl || config.branding?.logoUrl || config.branding?.logoLightUrl
      : config.branding?.logoLightUrl || config.branding?.logoUrl || config.branding?.logoDarkUrl;
    if (!raw) return null;
    try {
      const url = new URL(raw);
      return url.protocol === 'https:' ? url.toString() : null;
    } catch {
      return null;
    }
  }

  private isTransactionConflict(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
  }

  private isUniqueConflict(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private mapInvoice(invoice: Invoice): CommerceAppointmentInvoice {
    return {
      id: invoice.id,
      appointmentId: invoice.appointmentId,
      number: invoice.number,
      issuedAt: invoice.issuedAt.toISOString(),
      currency: invoice.currency,
      seller: {
        name: invoice.sellerName,
        taxId: invoice.sellerTaxId,
        address: invoice.sellerAddress,
        email: invoice.sellerEmail,
        phone: invoice.sellerPhone,
      },
      customer: {
        name: invoice.customerName,
        email: invoice.customerEmail,
        phone: invoice.customerPhone,
      },
      service: {
        name: invoice.serviceName,
        date: invoice.serviceDate.toISOString(),
        locationName: invoice.locationName,
        professionalName: invoice.professionalName,
      },
      amounts: {
        subtotal: Number(invoice.subtotal),
        taxRate: Number(invoice.taxRate),
        taxAmount: Number(invoice.taxAmount),
        total: Number(invoice.total),
      },
      branding: {
        logoUrl: invoice.logoUrl,
        primaryColor: invoice.primaryColor,
      },
    };
  }
}
