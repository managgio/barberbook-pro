import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as twilio from 'twilio';
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
  private readonly twilioCache = new Map<string, {
    client: twilio.Twilio;
    messagingServiceSid?: string | null;
    smsSenderId?: string | null;
    whatsappFrom?: string | null;
    whatsappTemplateSid?: string | null;
  } | null>();
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
    if (!twilioConfig?.accountSid || !twilioConfig.authToken) {
      this.logger.warn('Twilio credentials missing, SMS reminders disabled');
      this.twilioCache.set(brandId, null);
      return null;
    }
    const payload = {
      client: twilio(twilioConfig.accountSid, twilioConfig.authToken),
      messagingServiceSid: twilioConfig.messagingServiceSid || null,
      smsSenderId: twilioConfig.smsSenderId || null,
      whatsappFrom: twilioConfig.whatsappFrom || null,
      whatsappTemplateSid: twilioConfig.whatsappTemplateSid || null,
    };
    this.twilioCache.set(brandId, payload);
    return payload;
  }

  async sendAppointmentEmail(contact: ContactInfo, appointment: AppointmentInfo, action: 'creada' | 'actualizada' | 'cancelada') {
    const config = await this.tenantConfig.getEffectiveConfig();
    if (config.notificationPrefs?.email === false) return;
    const transporter = await this.getTransporter();
    if (!transporter || !contact.email) return;
    const settings = await this.getSettings();
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

  async sendReferralRewardEmail(params: { contact: ContactInfo; title: string; message: string; ctaLabel?: string; ctaUrl?: string }) {
    const config = await this.tenantConfig.getEffectiveConfig();
    if (config.notificationPrefs?.email === false) return;
    const transporter = await this.getTransporter();
    if (!transporter || !params.contact.email) return;
    const settings = await this.getSettings();
    const brandName =
      settings.branding.shortName ||
      settings.branding.name ||
      config.branding?.shortName ||
      config.branding?.name ||
      'Managgio';
    const contactEmail = settings.contact.email || config.email?.user || 'info@leblond.com';
    const brandColor = '#f472b6';
    const brandDark = '#0f0f12';
    const logoPath = this.resolveLogoPath();
    const logoCid = logoPath ? 'brand-logo' : undefined;
    const ctaLabel = params.ctaLabel || 'Ver mi recompensa';
    const ctaUrl = params.ctaUrl;

    const html = `
      <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; background:${brandDark}; padding:24px; color:#f8fafc;">
        <table style="width:100%; max-width:640px; margin:0 auto; background:#121218; border-radius:16px; overflow:hidden; border:1px solid rgba(255,255,255,0.06);">
          <tr style="background:linear-gradient(135deg, rgba(244,114,182,0.18), rgba(139,92,246,0.1)); border-bottom:1px solid rgba(255,255,255,0.08);">
            <td style="padding:22px 26px; display:flex; align-items:center; gap:22px;">
              ${logoCid ? `<img src="cid:${logoCid}" alt="${brandName}" width="48" height="48" style="border-radius:12px; display:block; background:#000; padding:6px;" />` : ''}
              <div style="margin-left:8px;">
                <div style="font-weight:700; font-size:18px; color:#fff;">${brandName}</div>
                <div style="font-size:12px; color:rgba(255,255,255,0.75); text-transform:uppercase; letter-spacing:0.08em;">Programa de referidos</div>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              <p style="margin:0 0 12px; font-size:16px;">Hola ${params.contact.name || 'cliente'},</p>
              <p style="margin:0 0 16px; color:rgba(248,250,252,0.8); line-height:1.6;">
                ${params.message}
              </p>
              ${
                ctaUrl
                  ? `<div style="margin-top:20px;">
                      <a href="${ctaUrl}" style="display:inline-block; padding:12px 18px; border-radius:999px; background:${brandColor}; color:#0b0b0e; text-decoration:none; font-weight:600;">
                        ${ctaLabel}
                      </a>
                    </div>`
                  : ''
              }
              <div style="margin-top:20px; padding:14px 16px; border-radius:12px; background:rgba(244,114,182,0.12); color:#fff; border:1px solid rgba(244,114,182,0.4);">
                <div style="font-weight:600; margin-bottom:4px;">Contacto</div>
                <div style="font-size:14px; color:rgba(248,250,252,0.8);">
                  <a href="mailto:${contactEmail}" style="color:#fff; text-decoration:none;">${contactEmail}</a>
                </div>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px; background:#0d0d10; color:rgba(248,250,252,0.6); font-size:12px; text-align:center;">
              © ${new Date().getFullYear()} ${brandName}. Gracias por confiar en nosotros.
            </td>
          </tr>
        </table>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: `"${config.email?.fromName || brandName}" <${contactEmail}>`,
        to: params.contact.email,
        subject: params.title,
        text: `${params.message}`,
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
      this.logger.error(`Error sending referral email to ${params.contact.email}: ${error}`);
    }
  }

  async sendReminderSms(contact: ContactInfo, appointment: AppointmentInfo) {
    const twilioConfig = await this.getTwilio();
    if (!twilioConfig || !contact.phone) return;
    const normalizedPhone = this.normalizePhoneNumber(contact.phone);
    if (!normalizedPhone) {
      this.logger.warn(`SMS skipped due to invalid phone: ${contact.phone}`);
      return;
    }
    const senderId = await this.resolveSmsSenderId(twilioConfig.smsSenderId || null);
    const formattedDate = appointment.date.toLocaleString('es-ES', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    const message = `Recordatorio: cita ${formattedDate}${appointment.serviceName ? ' - ' + appointment.serviceName : ''}. Si no puedes asistir, avísanos.`;

    try {
      if (!twilioConfig.messagingServiceSid && !senderId) {
        this.logger.warn('Twilio sender missing, SMS reminders disabled');
        return;
      }
      const result = await twilioConfig.client.messages.create({
        ...(twilioConfig.messagingServiceSid ? { messagingServiceSid: twilioConfig.messagingServiceSid } : { from: senderId! }),
        to: normalizedPhone,
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

  async sendTestSms(phone: string, message?: string | null) {
    const twilioConfig = await this.getTwilio();
    if (!twilioConfig) {
      throw new BadRequestException('Twilio no está configurado.');
    }
    const normalizedPhone = this.normalizePhoneNumber(phone);
    if (!normalizedPhone) {
      throw new BadRequestException('El teléfono debe tener formato internacional (ej: +346XXXXXXXX).');
    }
    const senderId = await this.resolveSmsSenderId(twilioConfig.smsSenderId || null);
    if (!twilioConfig.messagingServiceSid && !senderId) {
      throw new BadRequestException('El sender ID alfanumérico no es válido.');
    }
    const settings = await this.getSettings();
    const fallbackMessage = `SMS de prueba de ${settings.branding.shortName || settings.branding.name || 'Managgio'}.`;
    const body = (message || fallbackMessage).trim();
    if (!body) {
      throw new BadRequestException('El mensaje no puede estar vacío.');
    }

    try {
      const result = await twilioConfig.client.messages.create({
        ...(twilioConfig.messagingServiceSid
          ? { messagingServiceSid: twilioConfig.messagingServiceSid }
          : { from: senderId! }),
        to: normalizedPhone,
        body,
      });
      return { success: true, sid: result.sid };
    } catch (error) {
      this.logger.error(`Error sending test SMS to ${normalizedPhone}: ${error}`);
      throw new BadRequestException('No se pudo enviar el SMS de prueba.');
    }
  }

  async sendReminderWhatsapp(contact: ContactInfo, appointment: AppointmentInfo) {
    const twilioConfig = await this.getTwilio();
    if (!twilioConfig || !contact.phone) return;
    const normalizedPhone = this.normalizePhoneNumber(contact.phone);
    if (!normalizedPhone) {
      this.logger.warn(`WhatsApp skipped due to invalid phone: ${contact.phone}`);
      return;
    }
    const whatsappFrom = this.normalizePhoneNumber(twilioConfig.whatsappFrom || '');
    if (!whatsappFrom) {
      this.logger.warn('Twilio WhatsApp sender missing, WhatsApp reminders disabled');
      return;
    }
    const brandName = await this.resolveBrandName();
    const { dateValue, timeValue } = this.formatDateTime(appointment.date);
    const templateVariables = this.buildWhatsappTemplateVariables({
      name: contact.name || 'Cliente',
      brand: brandName,
      date: dateValue,
      time: timeValue,
    });
    const message = `Recordatorio: cita ${dateValue} ${timeValue}${appointment.serviceName ? ' - ' + appointment.serviceName : ''}. Si no puedes asistir, avísanos.`;

    try {
      const basePayload = {
        from: `whatsapp:${whatsappFrom}`,
        to: `whatsapp:${normalizedPhone}`,
      };
      const result = await twilioConfig.client.messages.create(
        twilioConfig.whatsappTemplateSid
          ? { ...basePayload, contentSid: twilioConfig.whatsappTemplateSid, contentVariables: templateVariables }
          : { ...basePayload, body: message },
      );
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
      this.logger.error(`Error sending WhatsApp to ${normalizedPhone}: ${error}`);
    }
  }

  async sendTestWhatsapp(phone: string, options?: { message?: string | null; name?: string; brand?: string; date?: string; time?: string }) {
    const twilioConfig = await this.getTwilio();
    if (!twilioConfig) {
      throw new BadRequestException('Twilio no está configurado.');
    }
    const normalizedPhone = this.normalizePhoneNumber(phone);
    if (!normalizedPhone) {
      throw new BadRequestException('El teléfono debe tener formato internacional (ej: +346XXXXXXXX).');
    }
    const whatsappFrom = this.normalizePhoneNumber(twilioConfig.whatsappFrom || '');
    if (!whatsappFrom) {
      throw new BadRequestException('El número de WhatsApp de Twilio no está configurado.');
    }
    const settings = await this.getSettings();
    const brandName = options?.brand?.trim()
      || settings.branding.shortName
      || settings.branding.name
      || 'Managgio';
    const fallbackMessage = `WhatsApp de prueba de ${brandName}.`;
    const body = (options?.message || fallbackMessage).trim();
    const now = new Date();
    const { dateValue, timeValue } = this.formatDateTime(now);
    const templateVariables = this.buildWhatsappTemplateVariables({
      name: options?.name?.trim() || 'Cliente',
      brand: brandName,
      date: options?.date?.trim() || dateValue,
      time: options?.time?.trim() || timeValue,
    });

    try {
      const basePayload = {
        from: `whatsapp:${whatsappFrom}`,
        to: `whatsapp:${normalizedPhone}`,
      };
      const result = await twilioConfig.client.messages.create(
        twilioConfig.whatsappTemplateSid
          ? { ...basePayload, contentSid: twilioConfig.whatsappTemplateSid, contentVariables: templateVariables }
          : { ...basePayload, body },
      );
      return { success: true, sid: result.sid };
    } catch (error) {
      this.logger.error(`Error sending test WhatsApp to ${normalizedPhone}: ${error}`);
      throw new BadRequestException('No se pudo enviar el WhatsApp de prueba.');
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

  private async resolveSmsSenderId(explicit?: string | null) {
    const candidate = explicit?.trim() || '';
    if (candidate) {
      return this.sanitizeSmsSenderId(candidate);
    }
    const settings = await this.getSettings();
    const config = await this.tenantConfig.getEffectiveConfig();
    const brandName =
      settings.branding.shortName ||
      settings.branding.name ||
      config.branding?.shortName ||
      config.branding?.name ||
      '';
    return this.sanitizeSmsSenderId(brandName);
  }

  private sanitizeSmsSenderId(value: string) {
    const cleaned = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 11);
    if (cleaned.length < 3) return null;
    return cleaned;
  }

  private buildWhatsappTemplateVariables(data: { name: string; brand: string; date: string; time: string }) {
    return JSON.stringify({
      1: data.name,
      2: data.brand,
      3: data.date,
      4: data.time,
    });
  }

  private formatDateTime(value: Date) {
    const dateValue = value.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const timeValue = value.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return { dateValue, timeValue };
  }

  private async resolveBrandName() {
    const settings = await this.getSettings();
    const config = await this.tenantConfig.getEffectiveConfig();
    return (
      settings.branding.shortName ||
      settings.branding.name ||
      config.branding?.shortName ||
      config.branding?.name ||
      'Managgio'
    );
  }

  private normalizePhoneNumber(value?: string | null) {
    const raw = value?.trim();
    if (!raw) return null;
    if (raw.startsWith('+')) {
      const digits = raw.replace(/\D/g, '');
      return digits ? `+${digits}` : null;
    }
    const digits = raw.replace(/\D/g, '');
    if (!digits) return null;
    if (digits.startsWith('00')) {
      const rest = digits.slice(2);
      return rest ? `+${rest}` : null;
    }
    if (digits.startsWith('34') && digits.length >= 11) {
      return `+${digits}`;
    }
    if (digits.length === 10 && digits.startsWith('0')) {
      return `+34${digits.slice(1)}`;
    }
    if (digits.length === 9) {
      return `+34${digits}`;
    }
    return null;
  }
}
