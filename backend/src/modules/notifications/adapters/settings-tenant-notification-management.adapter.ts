import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import {
  ENGAGEMENT_EMAIL_TRANSPORT_FACTORY_PORT,
  EngagementEmailTransportFactoryPort,
  EngagementEmailTransportPort,
} from '../../../contexts/engagement/ports/outbound/email-transport-factory.port';
import {
  ENGAGEMENT_TWILIO_CLIENT_FACTORY_PORT,
  EngagementTwilioClientFactoryPort,
  EngagementTwilioClientPort,
} from '../../../contexts/engagement/ports/outbound/twilio-client-factory.port';
import {
  EngagementNotificationAppointmentAction,
  EngagementNotificationAppointmentInfo,
  EngagementNotificationContactInfo,
  EngagementNotificationDeliveryResult,
  EngagementNotificationManagementPort,
  EngagementTestWhatsappInput,
} from '../../../contexts/engagement/ports/outbound/notification-management.port';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../../contexts/platform/ports/outbound/tenant-context.port';
import { TenantConfigService } from '../../../tenancy/tenant-config.service';
import { SettingsService } from '../../settings/settings.service';
import { SiteSettings } from '../../settings/settings.types';
import { UsageMetricsService } from '../../usage-metrics/usage-metrics.service';
import { APP_TIMEZONE } from '../../../utils/timezone';
import { createHash } from 'crypto';
import { describeEmailDeliveryError, describeTwilioDeliveryError } from '../notification-delivery-diagnostic';
import {
  buildSmtpTransportConfig,
  normalizeSmtpConfig,
  resolveDefaultSmtpHost,
} from '../../../contexts/engagement/domain/services/smtp-config.policy';

type TwilioTenantConfig = {
  client: EngagementTwilioClientPort;
  messagingServiceSid?: string | null;
  smsSenderId?: string | null;
  whatsappFrom?: string | null;
  whatsappTemplateSid?: string | null;
};

const readProviderMessageId = (result: unknown) => {
  if (!result || typeof result !== 'object') return null;
  const messageId = (result as { messageId?: unknown }).messageId;
  return typeof messageId === 'string' ? messageId : null;
};

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const resolveSendMailResult = (result: unknown): EngagementNotificationDeliveryResult => {
  if (result && typeof result === 'object') {
    const info = result as { accepted?: unknown; rejected?: unknown };
    const rejected = Array.isArray(info.rejected) ? info.rejected : [];
    const accepted = Array.isArray(info.accepted) ? info.accepted : null;
    if (rejected.length > 0 || (accepted && accepted.length === 0)) {
      return {
        status: 'failed',
        code: 'EMAIL_RECIPIENT_REJECTED',
        message: 'The SMTP server rejected the recipient address.',
        retryable: false,
        critical: false,
      };
    }
  }
  return { status: 'accepted', providerMessageId: readProviderMessageId(result) };
};

@Injectable()
export class SettingsTenantNotificationManagementAdapter implements EngagementNotificationManagementPort {
  private readonly logger = new Logger(SettingsTenantNotificationManagementAdapter.name);
  private readonly transporterCache = new Map<
    string,
    { fingerprint: string; transporter: EngagementEmailTransportPort }
  >();
  private readonly twilioCache = new Map<string, TwilioTenantConfig | null>();
  private settingsCache: Record<string, SiteSettings> = {};

  constructor(
    private readonly settingsService: SettingsService,
    private readonly tenantConfig: TenantConfigService,
    private readonly usageMetrics: UsageMetricsService,
    @Inject(ENGAGEMENT_EMAIL_TRANSPORT_FACTORY_PORT)
    private readonly emailTransportFactory: EngagementEmailTransportFactoryPort,
    @Inject(ENGAGEMENT_TWILIO_CLIENT_FACTORY_PORT)
    private readonly twilioClientFactory: EngagementTwilioClientFactoryPort,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
  ) {}

  private async getTransporter() {
    const brandId = this.getBrandId();
    const localId = this.getLocalId();
    const scopeKey = `${brandId}:${localId}`;
    const config = await this.tenantConfig.getEffectiveConfig();
    const emailConfig = normalizeSmtpConfig(config.email);
    if (!emailConfig?.user || !emailConfig?.password) {
      this.logger.warn(`Email credentials missing, email notifications disabled brandId=${brandId} localId=${localId}`);
      this.transporterCache.delete(scopeKey);
      return null;
    }

    const host = emailConfig.host || resolveDefaultSmtpHost(emailConfig.user);
    const port = emailConfig.port || 587;
    const fingerprint = createHash('sha256')
      .update(`${host}\u0000${port}\u0000${emailConfig.user}\u0000${emailConfig.password}`)
      .digest('hex');
    const cached = this.transporterCache.get(scopeKey);
    if (cached?.fingerprint === fingerprint) return cached.transporter;

    const transporter = this.emailTransportFactory.createTransport(buildSmtpTransportConfig({
      host,
      port,
      user: emailConfig.user,
      password: emailConfig.password,
    }));
    this.transporterCache.set(scopeKey, { fingerprint, transporter });
    return transporter;
  }

  private async getTwilio() {
    const brandId = this.getBrandId();
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
    const payload: TwilioTenantConfig = {
      client: this.twilioClientFactory.createClient(twilioConfig.accountSid, twilioConfig.authToken),
      messagingServiceSid: twilioConfig.messagingServiceSid || null,
      smsSenderId: twilioConfig.smsSenderId || null,
      whatsappFrom: twilioConfig.whatsappFrom || null,
      whatsappTemplateSid: twilioConfig.whatsappTemplateSid || null,
    };
    this.twilioCache.set(brandId, payload);
    return payload;
  }

  async sendAppointmentEmail(
    contact: EngagementNotificationContactInfo,
    appointment: EngagementNotificationAppointmentInfo,
    action: EngagementNotificationAppointmentAction,
  ): Promise<EngagementNotificationDeliveryResult> {
    const config = await this.tenantConfig.getEffectiveConfig();
    if (config.notificationPrefs?.email === false) {
      return { status: 'skipped', code: 'EMAIL_DISABLED', message: 'Email notifications are disabled for this tenant.' };
    }
    if (!contact.email) {
      return { status: 'skipped', code: 'EMAIL_RECIPIENT_MISSING', message: 'No recipient email is available.' };
    }
    const transporter = await this.getTransporter();
    if (!transporter) {
      return {
        status: 'failed',
        code: 'SMTP_NOT_CONFIGURED',
        message: 'Tenant SMTP credentials are not configured.',
        retryable: false,
        critical: true,
      };
    }
    const settings = await this.getSettings();
    const formattedDate = this.formatAppointmentEmailDate(appointment.date);

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
    const safeBrandName = escapeHtml(brandName);
    const safeContactName = escapeHtml(contact.name || 'cliente');
    const safeFormattedDate = escapeHtml(formattedDate);
    const safeServiceName = escapeHtml(appointment.serviceName);
    const safeBarberName = escapeHtml(appointment.barberName);
    const safeLocation = escapeHtml(location);
    const safeContactEmail = escapeHtml(contactEmail);
    const safeContactPhone = escapeHtml(contactPhone);

    const html = `
      <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; background:${brandDark}; padding:24px; color:#f8fafc;">
        <table style="width:100%; max-width:640px; margin:0 auto; background:#121218; border-radius:16px; overflow:hidden; border:1px solid rgba(255,255,255,0.06);">
          <tr style="background:linear-gradient(135deg, rgba(244,114,182,0.18), rgba(139,92,246,0.1)); border-bottom:1px solid rgba(255,255,255,0.08);">
            <td style="padding:22px 26px; display:flex; align-items:center; gap:22px;">
              ${logoCid ? `<img src="cid:${logoCid}" alt="${safeBrandName}" width="48" height="48" style="border-radius:12px; display:block; background:#000; padding:6px;" />` : ''}
              <div style="margin-left:8px;">
                <div style="font-weight:700; font-size:18px; color:#fff;">${safeBrandName}</div>
                <div style="font-size:12px; color:rgba(255,255,255,0.75); text-transform:uppercase; letter-spacing:0.08em;">${action === 'cancelada' ? 'Cita cancelada' : 'Cita ' + action}</div>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              <p style="margin:0 0 12px; font-size:16px;">Hola ${safeContactName},</p>
              <p style="margin:0 0 16px; color:rgba(248,250,252,0.8); line-height:1.6;">
                ${action === 'cancelada'
                  ? 'Tu cita ha sido cancelada.'
                  : `Tu cita ha sido ${action}.`}
              </p>
              <div style="border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:16px; background:rgba(255,255,255,0.02); margin-bottom:16px;">
                <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:14px; color:rgba(248,250,252,0.85); margin-bottom:10px;">
                  <div>Fecha y hora:&nbsp;</div>
                  <div style="text-align:right; color:${brandColor}; font-weight:700;">${safeFormattedDate}</div>
                </div>
                ${
                  appointment.serviceName
                    ? `<div style="display:flex; align-items:flex-start; justify-content:space-between; gap:14px; color:rgba(248,250,252,0.85); margin-bottom:10px;">
                        <div>Servicio:&nbsp;</div>
                        <div style="text-align:right; color:#fff; font-weight:700;">${safeServiceName}</div>
                      </div>`
                    : ''
                }
                ${
                  appointment.barberName
                    ? `<div style="display:flex; align-items:flex-start; justify-content:space-between; gap:14px; color:rgba(248,250,252,0.85); margin-bottom:10px;">
                        <div>Barbero:&nbsp;</div>
                        <div style="text-align:right; color:#fff; font-weight:700;">${safeBarberName}</div>
                      </div>`
                    : ''
                }
                <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:14px; color:rgba(248,250,252,0.85);">
                  <div>Ubicación:&nbsp;</div>
                  <div style="text-align:right; color:#fff; font-weight:700;">${safeLocation}</div>
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
                  <a href="mailto:${safeContactEmail}" style="color:#fff; text-decoration:none;">${safeContactEmail}</a>
                  ${contactPhone ? `<br/><a href="https://wa.me/${contactPhone.replace(/\\D/g, '')}" style="color:#fff; text-decoration:none;">${safeContactPhone}</a>` : ''}
                </div>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px; background:#0d0d10; color:rgba(248,250,252,0.6); font-size:12px; text-align:center;">
              © ${new Date().getFullYear()} ${safeBrandName}. Cuidamos tu look con detalle.
            </td>
          </tr>
        </table>
      </div>
    `;

    try {
      const result = await transporter.sendMail({
        from: `"${config.email?.fromName || brandName}" <${config.email?.user}>`,
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
      return resolveSendMailResult(result);
    } catch (error) {
      const diagnostic = this.logEmailDeliveryError(error, config.email);
      return {
        status: 'failed',
        code: diagnostic.code,
        message: diagnostic.safeMessage,
        retryable: diagnostic.retryable,
        critical: diagnostic.critical,
      };
    }
  }

  async sendReferralRewardEmail(params: {
    contact: EngagementNotificationContactInfo;
    title: string;
    message: string;
    ctaLabel?: string;
    ctaUrl?: string;
  }): Promise<EngagementNotificationDeliveryResult> {
    const config = await this.tenantConfig.getEffectiveConfig();
    if (config.notificationPrefs?.email === false) {
      return { status: 'skipped', code: 'EMAIL_DISABLED', message: 'Email notifications are disabled for this tenant.' };
    }
    if (!params.contact.email) {
      return { status: 'skipped', code: 'EMAIL_RECIPIENT_MISSING', message: 'No recipient email is available.' };
    }
    const transporter = await this.getTransporter();
    if (!transporter) {
      return {
        status: 'failed',
        code: 'SMTP_NOT_CONFIGURED',
        message: 'Tenant SMTP credentials are not configured.',
        retryable: false,
        critical: true,
      };
    }
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
    const ctaLabel = escapeHtml(params.ctaLabel || 'Ver mi recompensa');
    const ctaUrl = params.ctaUrl && (/^https?:\/\//i.test(params.ctaUrl) || params.ctaUrl.startsWith('/'))
      ? escapeHtml(params.ctaUrl)
      : undefined;
    const safeBrandName = escapeHtml(brandName);
    const safeContactName = escapeHtml(params.contact.name || 'cliente');
    const safeMessage = escapeHtml(params.message).replace(/\n/g, '<br/>');
    const safeContactEmail = escapeHtml(contactEmail);

    const html = `
      <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; background:${brandDark}; padding:24px; color:#f8fafc;">
        <table style="width:100%; max-width:640px; margin:0 auto; background:#121218; border-radius:16px; overflow:hidden; border:1px solid rgba(255,255,255,0.06);">
          <tr style="background:linear-gradient(135deg, rgba(244,114,182,0.18), rgba(139,92,246,0.1)); border-bottom:1px solid rgba(255,255,255,0.08);">
            <td style="padding:22px 26px; display:flex; align-items:center; gap:22px;">
              ${logoCid ? `<img src="cid:${logoCid}" alt="${safeBrandName}" width="48" height="48" style="border-radius:12px; display:block; background:#000; padding:6px;" />` : ''}
              <div style="margin-left:8px;">
                <div style="font-weight:700; font-size:18px; color:#fff;">${safeBrandName}</div>
                <div style="font-size:12px; color:rgba(255,255,255,0.75); text-transform:uppercase; letter-spacing:0.08em;">Programa de referidos</div>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              <p style="margin:0 0 12px; font-size:16px;">Hola ${safeContactName},</p>
              <p style="margin:0 0 16px; color:rgba(248,250,252,0.8); line-height:1.6;">
                ${safeMessage}
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
                  <a href="mailto:${safeContactEmail}" style="color:#fff; text-decoration:none;">${safeContactEmail}</a>
                </div>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px; background:#0d0d10; color:rgba(248,250,252,0.6); font-size:12px; text-align:center;">
              © ${new Date().getFullYear()} ${safeBrandName}. Gracias por confiar en nosotros.
            </td>
          </tr>
        </table>
      </div>
    `;

    try {
      const result = await transporter.sendMail({
        from: `"${config.email?.fromName || brandName}" <${config.email?.user}>`,
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
      return resolveSendMailResult(result);
    } catch (error) {
      const diagnostic = this.logEmailDeliveryError(error, config.email);
      return {
        status: 'failed',
        code: diagnostic.code,
        message: diagnostic.safeMessage,
        retryable: diagnostic.retryable,
        critical: diagnostic.critical,
      };
    }
  }

  async sendBroadcastEmail(params: {
    contact: EngagementNotificationContactInfo;
    subject: string;
    message: string;
  }): Promise<EngagementNotificationDeliveryResult> {
    const config = await this.tenantConfig.getEffectiveConfig();
    if (config.notificationPrefs?.email === false) {
      return { status: 'skipped', code: 'EMAIL_DISABLED', message: 'Email notifications are disabled for this tenant.' };
    }
    const transporter = await this.getTransporter();
    const to = params.contact.email?.trim();
    if (!to) {
      return { status: 'skipped', code: 'EMAIL_RECIPIENT_MISSING', message: 'No recipient email is available.' };
    }
    if (!transporter) {
      return {
        status: 'failed',
        code: 'SMTP_NOT_CONFIGURED',
        message: 'Tenant SMTP credentials are not configured.',
        retryable: false,
        critical: true,
      };
    }
    const settings = await this.getSettings();
    const brandName =
      settings.branding.shortName ||
      settings.branding.name ||
      config.branding?.shortName ||
      config.branding?.name ||
      'Managgio';
    const safeMessage = escapeHtml(params.message).replace(/\n/g, '<br/>');
    const safeBrandName = escapeHtml(brandName);
    const html = `
      <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; background:#0f0f12; padding:24px; color:#f8fafc;">
        <table style="width:100%; max-width:640px; margin:0 auto; background:#121218; border-radius:16px; overflow:hidden; border:1px solid rgba(255,255,255,0.06);">
          <tr>
            <td style="padding:22px 24px; border-bottom:1px solid rgba(255,255,255,0.08);">
              <div style="font-weight:700; font-size:18px; color:#fff;">${safeBrandName}</div>
              <div style="font-size:12px; color:rgba(255,255,255,0.75); text-transform:uppercase; letter-spacing:0.08em;">Comunicado</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px; color:rgba(248,250,252,0.88); line-height:1.6;">
              ${safeMessage}
            </td>
          </tr>
        </table>
      </div>
    `;

    try {
      const result = await transporter.sendMail({
        from: `"${config.email?.fromName || brandName}" <${config.email?.user}>`,
        to,
        subject: params.subject,
        text: params.message,
        html,
      });
      return resolveSendMailResult(result);
    } catch (error) {
      const diagnostic = this.logEmailDeliveryError(error, config.email);
      return {
        status: 'failed',
        code: diagnostic.code,
        message: diagnostic.safeMessage,
        retryable: diagnostic.retryable,
        critical: diagnostic.critical,
      };
    }
  }

  async sendReminderSms(contact: EngagementNotificationContactInfo, appointment: EngagementNotificationAppointmentInfo) {
    const formattedDate = this.formatReminderSmsDate(appointment.date);
    const message = `Recordatorio: cita ${formattedDate}${appointment.serviceName ? ' - ' + appointment.serviceName : ''}. Si no puedes asistir, avísanos.`;
    return this.sendSmsMessage(contact, message);
  }

  sendBroadcastSms(params: {
    contact: EngagementNotificationContactInfo;
    message: string;
  }) {
    return this.sendSmsMessage(params.contact, params.message);
  }

  async sendTestSms(phone: string, message?: string | null) {
    const settings = await this.getSettings();
    const fallbackMessage = `SMS de prueba de ${settings.branding.shortName || settings.branding.name || 'Managgio'}.`;
    const body = (message || fallbackMessage).trim();
    if (!body) {
      throw new BadRequestException('El mensaje no puede estar vacío.');
    }
    const result = await this.sendSmsMessage({ phone }, body);
    if (result.status !== 'accepted') throw new BadRequestException(result.message);
    return { success: true, sid: result.providerMessageId || '' };
  }

  async sendReminderWhatsapp(
    contact: EngagementNotificationContactInfo,
    appointment: EngagementNotificationAppointmentInfo,
  ) {
    const brandName = await this.resolveBrandName();
    const { dateValue, timeValue } = this.formatDateTime(appointment.date);
    const message = `Recordatorio: cita ${dateValue} ${timeValue}${appointment.serviceName ? ' - ' + appointment.serviceName : ''}. Si no puedes asistir, avísanos.`;
    return this.sendWhatsappMessage(contact, message, {
      name: contact.name || 'Cliente',
      brand: brandName,
      date: dateValue,
      time: timeValue,
    });
  }

  async sendBroadcastWhatsapp(params: {
    contact: EngagementNotificationContactInfo;
    message: string;
    date?: string;
    time?: string;
  }) {
    const brandName = await this.resolveBrandName();
    const now = this.formatDateTime(new Date());
    return this.sendWhatsappMessage(params.contact, params.message, {
      name: params.contact.name || 'Cliente',
      brand: brandName,
      date: params.date || now.dateValue,
      time: params.time || now.timeValue,
    });
  }

  async sendTestWhatsapp(phone: string, options?: EngagementTestWhatsappInput) {
    const settings = await this.getSettings();
    const brandName = options?.brand?.trim()
      || settings.branding.shortName
      || settings.branding.name
      || 'Managgio';
    const fallbackMessage = `WhatsApp de prueba de ${brandName}.`;
    const body = (options?.message || fallbackMessage).trim();
    const now = new Date();
    const { dateValue, timeValue } = this.formatDateTime(now);
    const result = await this.sendWhatsappMessage({ phone, name: options?.name }, body, {
      name: options?.name?.trim() || 'Cliente',
      brand: brandName,
      date: options?.date?.trim() || dateValue,
      time: options?.time?.trim() || timeValue,
    });
    if (result.status !== 'accepted') throw new BadRequestException(result.message);
    return { success: true, sid: result.providerMessageId || '' };
  }

  private async sendSmsMessage(
    contact: EngagementNotificationContactInfo,
    body: string,
  ): Promise<EngagementNotificationDeliveryResult> {
    const config = await this.tenantConfig.getEffectiveConfig();
    if (config.notificationPrefs?.sms === false) {
      return { status: 'skipped', code: 'SMS_DISABLED', message: 'SMS notifications are disabled for this tenant.' };
    }
    if (!contact.phone) {
      return { status: 'skipped', code: 'PHONE_RECIPIENT_MISSING', message: 'No recipient phone is available.' };
    }
    const normalizedPhone = this.normalizePhoneNumber(contact.phone);
    if (!normalizedPhone) {
      return {
        status: 'failed',
        code: 'PHONE_RECIPIENT_INVALID',
        message: 'The recipient phone must use international format.',
        retryable: false,
        critical: false,
      };
    }
    const twilioConfig = await this.getTwilio();
    if (!twilioConfig) {
      return {
        status: 'failed',
        code: 'TWILIO_NOT_CONFIGURED',
        message: 'Twilio credentials are not configured for this tenant.',
        retryable: false,
        critical: true,
      };
    }
    const senderId = await this.resolveSmsSenderId(twilioConfig.smsSenderId || null);
    if (!twilioConfig.messagingServiceSid && !senderId) {
      return {
        status: 'failed',
        code: 'SMS_SENDER_MISSING',
        message: 'No valid SMS sender is configured for this tenant.',
        retryable: false,
        critical: true,
      };
    }
    try {
      const result = await twilioConfig.client.messages.create({
        ...(twilioConfig.messagingServiceSid
          ? { messagingServiceSid: twilioConfig.messagingServiceSid }
          : { from: senderId! }),
        to: normalizedPhone,
        body,
      });
      this.recordTwilioUsage(result);
      return { status: 'accepted', providerMessageId: result.sid };
    } catch (error) {
      return this.toTwilioFailure(error, 'sms');
    }
  }

  private async sendWhatsappMessage(
    contact: EngagementNotificationContactInfo,
    body: string,
    templateData: { name: string; brand: string; date: string; time: string },
  ): Promise<EngagementNotificationDeliveryResult> {
    const config = await this.tenantConfig.getEffectiveConfig();
    if (config.notificationPrefs?.whatsapp === false) {
      return { status: 'skipped', code: 'WHATSAPP_DISABLED', message: 'WhatsApp notifications are disabled for this tenant.' };
    }
    if (!contact.phone) {
      return { status: 'skipped', code: 'PHONE_RECIPIENT_MISSING', message: 'No recipient phone is available.' };
    }
    const normalizedPhone = this.normalizePhoneNumber(contact.phone);
    if (!normalizedPhone) {
      return {
        status: 'failed',
        code: 'PHONE_RECIPIENT_INVALID',
        message: 'The recipient phone must use international format.',
        retryable: false,
        critical: false,
      };
    }
    const twilioConfig = await this.getTwilio();
    if (!twilioConfig) {
      return {
        status: 'failed',
        code: 'TWILIO_NOT_CONFIGURED',
        message: 'Twilio credentials are not configured for this tenant.',
        retryable: false,
        critical: true,
      };
    }
    const whatsappFrom = this.normalizePhoneNumber(twilioConfig.whatsappFrom || '');
    if (!whatsappFrom) {
      return {
        status: 'failed',
        code: 'WHATSAPP_SENDER_MISSING',
        message: 'No valid WhatsApp sender is configured for this tenant.',
        retryable: false,
        critical: true,
      };
    }
    try {
      const basePayload = {
        from: `whatsapp:${whatsappFrom}`,
        to: `whatsapp:${normalizedPhone}`,
      };
      const result = await twilioConfig.client.messages.create(
        twilioConfig.whatsappTemplateSid
          ? {
              ...basePayload,
              contentSid: twilioConfig.whatsappTemplateSid,
              contentVariables: this.buildWhatsappTemplateVariables(templateData),
            }
          : { ...basePayload, body },
      );
      this.recordTwilioUsage(result);
      return { status: 'accepted', providerMessageId: result.sid };
    } catch (error) {
      return this.toTwilioFailure(error, 'whatsapp');
    }
  }

  private recordTwilioUsage(result: { price: string | null; priceUnit: string | null }) {
    const rawPrice = result.price ? Math.abs(Number(result.price)) : null;
    const priceUnit = result.priceUnit?.toUpperCase();
    const fallbackCost = this.getTwilioSmsCostUsd();
    const costUsd = priceUnit && priceUnit !== 'USD'
      ? fallbackCost
      : (Number.isFinite(rawPrice) ? rawPrice : fallbackCost);
    void this.usageMetrics.recordTwilioUsage(
      costUsd !== null || fallbackCost !== null ? { costUsd, messages: 1 } : { messages: 1 },
    );
  }

  private toTwilioFailure(error: unknown, channel: 'sms' | 'whatsapp'): EngagementNotificationDeliveryResult {
    const diagnostic = describeTwilioDeliveryError(error, channel);
    this.logger.error(
      `${diagnostic.code} brandId=${this.getBrandId()} localId=${this.getLocalId()} ${diagnostic.safeMessage}`,
    );
    return {
      status: 'failed',
      code: diagnostic.code,
      message: diagnostic.safeMessage,
      retryable: diagnostic.retryable,
      critical: diagnostic.critical,
    };
  }

  private async getSettings(): Promise<SiteSettings> {
    const key = this.getLocalId();
    if (!this.settingsCache[key]) {
      this.settingsCache[key] = await this.settingsService.getSettings();
    }
    return this.settingsCache[key];
  }

  private getBrandId() {
    return this.tenantContextPort.getRequestContext().brandId;
  }

  private getLocalId() {
    return this.tenantContextPort.getRequestContext().localId;
  }

  private logEmailDeliveryError(
    error: unknown,
    emailConfig?: { user?: string; host?: string },
  ) {
    const diagnostic = describeEmailDeliveryError(error, {
      host: emailConfig?.host || resolveDefaultSmtpHost(emailConfig?.user),
      user: emailConfig?.user,
    });
    this.logger.error(
      `${diagnostic.code} brandId=${this.getBrandId()} localId=${this.getLocalId()} ${diagnostic.safeMessage}`,
    );
    return diagnostic;
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
      timeZone: APP_TIMEZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const timeValue = value.toLocaleTimeString('es-ES', {
      timeZone: APP_TIMEZONE,
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

  private formatAppointmentEmailDate(value: Date) {
    return value.toLocaleString('es-ES', {
      timeZone: APP_TIMEZONE,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  private formatReminderSmsDate(value: Date) {
    return value.toLocaleString('es-ES', {
      timeZone: APP_TIMEZONE,
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
}
