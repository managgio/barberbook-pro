import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import twilio from 'twilio';
import * as path from 'path';
import * as fs from 'fs';
import { SettingsService } from '../settings/settings.service';
import { SiteSettings } from '../settings/settings.types';
import { TenantConfigService } from '../../tenancy/tenant-config.service';
import { getCurrentBrandId, getCurrentLocalId } from '../../tenancy/tenant.context';
import { UsageMetricsService } from '../usage-metrics/usage-metrics.service';

interface ContactInfo {
  email?: string | null;
  phone?: string | null;
  name?: string | null;
}

interface AppointmentInfo {
  date: Date;
  serviceName?: string;
  barberName?: string;
  location?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly transporterCache = new Map<string, nodemailer.Transporter | null>();
  private readonly twilioCache = new Map<string, { client: twilio.Twilio; messagingServiceSid: string } | null>();
  private settingsCache: Record<string, SiteSettings> = {};

  constructor(
    private readonly settingsService: SettingsService,
    private readonly tenantConfig: TenantConfigService,
    private readonly usageMetrics: UsageMetricsService,
  ) {}

  private async getTransporter() {
    const brandId = getCurrentBrandId();
    if (this.transporterCache.has(brandId)) {
      return this.transporterCache.get(brandId) || null;
    }

    const config = await this.tenantConfig.getEffectiveConfig();
    const emailConfig = config.email;
    if (!emailConfig?.user || !emailConfig?.password) {
      this.logger.warn('Email credentials missing, email notifications disabled');
      this.transporterCache.set(brandId, null);
      return null;
    }

    const host = emailConfig.host || 'smtp.gmail.com';
    const port = emailConfig.port || 587;
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user: emailConfig.user,
        pass: emailConfig.password,
      },
    });
    this.transporterCache.set(brandId, transporter);
    return transporter;
  }

  private async getTwilio() {
    const brandId = getCurrentBrandId();
    if (this.twilioCache.has(brandId)) {
      return this.twilioCache.get(brandId) || null;
    }
    const config = await this.tenantConfig.getEffectiveConfig();
    const twilioConfig = config.twilio;
    if (!twilioConfig?.accountSid || !twilioConfig.authToken || !twilioConfig.messagingServiceSid) {
      this.logger.warn('Twilio credentials missing, SMS reminders disabled');
      this.twilioCache.set(brandId, null);
      return null;
    }
    const payload = {
      client: twilio(twilioConfig.accountSid, twilioConfig.authToken),
      messagingServiceSid: twilioConfig.messagingServiceSid,
    };
    this.twilioCache.set(brandId, payload);
    return payload;
  }

  async sendAppointmentEmail(contact: ContactInfo, appointment: AppointmentInfo, action: 'creada' | 'actualizada' | 'cancelada') {
    const transporter = await this.getTransporter();
    if (!transporter || !contact.email) return;
    const settings = await this.getSettings();
    const config = await this.tenantConfig.getEffectiveConfig();
    const formattedDate = appointment.date.toLocaleString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const subject = action === 'cancelada' ? 'Tu cita ha sido cancelada' : `Tu cita ha sido ${action}`;
    const textLines = [
      `Hola ${contact.name || ''}`.trim(),
      action === 'cancelada'
        ? 'Tu cita ha sido cancelada.'
        : `Tu cita ha sido ${action}.`,
      `Fecha y hora: ${formattedDate}.`,
    ];
    if (appointment.serviceName) textLines.push(`Servicio: ${appointment.serviceName}.`);
    if (appointment.barberName) textLines.push(`Barbero: ${appointment.barberName}.`);
    if (appointment.location) textLines.push(`Lugar: ${appointment.location}.`);
    textLines.push(
      action === 'cancelada'
        ? 'Si quieres reprogramar, contáctanos y te ayudamos.'
        : 'Si necesitas cambiar algo, contáctanos.',
    );

    const brandName =
      settings.branding.shortName ||
      settings.branding.name ||
      config.branding?.shortName ||
      config.branding?.name ||
      'Le Blond Hair Salon';
    const brandColor = '#f472b6';
    const brandDark = '#0f0f12';
    const contactEmail = settings.contact.email || config.email?.user || 'info@leblond.com';
    const contactPhone = settings.contact.phone || '';
    const location = appointment.location || settings.location.label || 'Le Blond Hair Salon';
    const logoPath = this.resolveLogoPath();
    const logoCid = logoPath ? 'brand-logo' : undefined;

    const html = `
      <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; background:${brandDark}; padding:24px; color:#f8fafc;">
        <table style="width:100%; max-width:640px; margin:0 auto; background:#121218; border-radius:16px; overflow:hidden; border:1px solid rgba(255,255,255,0.06);">
          <tr style="background:linear-gradient(135deg, rgba(244,114,182,0.18), rgba(139,92,246,0.1)); border-bottom:1px solid rgba(255,255,255,0.08);">
            <td style="padding:22px 26px; display:flex; align-items:center; gap:22px;">
              ${logoCid ? `<img src="cid:${logoCid}" alt="${brandName}" width="48" height="48" style="border-radius:12px; display:block; background:#000; padding:6px;" />` : ''}
              <div style="margin-left:8px;">
                <div style="font-weight:700; font-size:18px; color:#fff;">${brandName}</div>
                <div style="font-size:12px; color:rgba(255,255,255,0.75); text-transform:uppercase; letter-spacing:0.08em;">${action === 'cancelada' ? 'Cita cancelada' : 'Cita ' + action}</div>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              <p style="margin:0 0 12px; font-size:16px;">Hola ${contact.name || 'cliente'},</p>
              <p style="margin:0 0 16px; color:rgba(248,250,252,0.8); line-height:1.6;">
                ${action === 'cancelada'
                  ? 'Tu cita ha sido cancelada.'
                  : `Tu cita ha sido ${action}.`}
              </p>
              <div style="border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:16px; background:rgba(255,255,255,0.02); margin-bottom:16px;">
                <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:14px; color:rgba(248,250,252,0.85); margin-bottom:10px;">
                  <div>Fecha y hora:&nbsp;</div>
                  <div style="text-align:right; color:${brandColor}; font-weight:700;">${formattedDate}</div>
                </div>
                ${
                  appointment.serviceName
                    ? `<div style="display:flex; align-items:flex-start; justify-content:space-between; gap:14px; color:rgba(248,250,252,0.85); margin-bottom:10px;">
                        <div>Servicio:&nbsp;</div>
                        <div style="text-align:right; color:#fff; font-weight:700;">${appointment.serviceName}</div>
                      </div>`
                    : ''
                }
                ${
                  appointment.barberName
                    ? `<div style="display:flex; align-items:flex-start; justify-content:space-between; gap:14px; color:rgba(248,250,252,0.85); margin-bottom:10px;">
                        <div>Barbero:&nbsp;</div>
                        <div style="text-align:right; color:#fff; font-weight:700;">${appointment.barberName}</div>
                      </div>`
                    : ''
                }
                <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:14px; color:rgba(248,250,252,0.85);">
                  <div>Ubicación:&nbsp;</div>
                  <div style="text-align:right; color:#fff; font-weight:700;">${location}</div>
                </div>
              </div>
              <p style="margin:0 0 12px; color:rgba(248,250,252,0.75);">
                ${action === 'cancelada'
                  ? 'Si quieres reprogramar, contáctanos y te ayudamos.'
                  : 'Si necesitas ajustar algo de tu cita, estamos disponibles para ayudarte.'}
              </p>
              <div style="margin-top:20px; padding:14px 16px; border-radius:12px; background:rgba(244,114,182,0.12); color:#fff; border:1px solid rgba(244,114,182,0.4);">
                <div style="font-weight:600; margin-bottom:4px;">Contacto</div>
                <div style="font-size:14px; color:rgba(248,250,252,0.8);">
                  <a href="mailto:${contactEmail}" style="color:#fff; text-decoration:none;">${contactEmail}</a>
                  ${contactPhone ? `<br/><a href="https://wa.me/${contactPhone.replace(/\\D/g, '')}" style="color:#fff; text-decoration:none;">${contactPhone}</a>` : ''}
                </div>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px; background:#0d0d10; color:rgba(248,250,252,0.6); font-size:12px; text-align:center;">
              © ${new Date().getFullYear()} ${brandName}. Cuidamos tu look con detalle.
            </td>
          </tr>
        </table>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: `"${config.email?.fromName || brandName}" <${contactEmail}>`,
        to: contact.email,
        subject,
        text: textLines.join('\n'),
        html,
        attachments: logoCid && logoPath
          ? [
              {
                filename: path.basename(logoPath),
                path: logoPath,
                cid: logoCid,
              },
            ]
          : [],
      });
    } catch (error) {
      this.logger.error(`Error sending email to ${contact.email}: ${error}`);
    }
  }

  async sendReminderSms(contact: ContactInfo, appointment: AppointmentInfo) {
    const twilioConfig = await this.getTwilio();
    if (!twilioConfig || !contact.phone) return;
    const formattedDate = appointment.date.toLocaleString('es-ES', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    const message = `Recordatorio: cita ${formattedDate}${appointment.serviceName ? ' - ' + appointment.serviceName : ''}. Si no puedes asistir, avísanos.`;

    try {
      const result = await twilioConfig.client.messages.create({
        messagingServiceSid: twilioConfig.messagingServiceSid,
        to: contact.phone,
        body: message,
      });
      const rawPrice = result.price ? Math.abs(Number(result.price)) : null;
      const priceUnit = result.priceUnit?.toUpperCase();
      const fallbackCost = this.getTwilioSmsCostUsd();
      const costUsd = priceUnit && priceUnit !== 'USD'
        ? fallbackCost
        : (Number.isFinite(rawPrice) ? rawPrice : fallbackCost);
      if (costUsd !== null || fallbackCost !== null) {
        void this.usageMetrics.recordTwilioUsage({
          costUsd,
          messages: 1,
        });
      } else {
        void this.usageMetrics.recordTwilioUsage({ messages: 1 });
      }
    } catch (error) {
      this.logger.error(`Error sending SMS to ${contact.phone}: ${error}`);
    }
  }

  private async getSettings(): Promise<SiteSettings> {
    const key = getCurrentLocalId();
    if (!this.settingsCache[key]) {
      this.settingsCache[key] = await this.settingsService.getSettings();
    }
    return this.settingsCache[key];
  }

  private resolveLogoPath(): string | null {
    const candidate = path.resolve(process.cwd(), 'assets', 'leBlondLogo.png');
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    return null;
  }

  private getTwilioSmsCostUsd() {
    const raw = process.env.TWILIO_SMS_COST_USD || '';
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
