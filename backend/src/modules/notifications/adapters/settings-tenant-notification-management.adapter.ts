import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import {
  ENGAGEMENT_EMAIL_TRANSPORT_FACTORY_PORT,
  EngagementEmailTransportFactoryPort,
  EngagementEmailTransportPort,
} from '../../../contexts/engagement/ports/outbound/email-transport-factory.port';
import {
  ENGAGEMENT_SMS_GATEWAY_PORT,
  EngagementSmsGatewayPort,
  EngagementSmsGatewayResult,
} from '../../../contexts/engagement/ports/outbound/sms-gateway.port';
import {
  ENGAGEMENT_WHATSAPP_GATEWAY_PORT,
  EngagementWhatsappGatewayPort,
  EngagementWhatsappGatewayResult,
} from '../../../contexts/engagement/ports/outbound/whatsapp-gateway.port';
import {
  EngagementNotificationAppointmentAction,
  EngagementNotificationAppointmentInfo,
  EngagementNotificationContactInfo,
  EngagementNotificationDeliveryContext,
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
import { describeEmailDeliveryError } from '../notification-delivery-diagnostic';
import {
  buildSmtpTransportConfig,
  getSmtpConfigValidationIssue,
  requireCompleteSmtpConfig,
  resolveDefaultSmtpHost,
} from '../../../contexts/engagement/domain/services/smtp-config.policy';
import {
  escapeEmailHtml,
  getTenantEmailLogoAttachments,
  renderBrandedEmail,
  resolveTenantEmailBranding,
} from '../email-branding';
import { canSendRoutineSms } from '../../../contexts/engagement/domain/services/sms-delivery-runtime.policy';
import { normalizeSmsRecipient } from '../../../contexts/engagement/domain/services/sms-recipient.policy';
import { buildSmsReminderMessage } from '../../../contexts/engagement/domain/services/sms-reminder-message.policy';
import {
  analyzeSmsSegmentation,
  SMS_MAX_STANDARD_SEGMENTS,
} from '../../../contexts/engagement/domain/services/sms-segmentation.policy';

type EmailTransportFailure = Extract<EngagementNotificationDeliveryResult, { status: 'failed' }>;
type EmailTransportResolution =
  | { transporter: EngagementEmailTransportPort; failure?: never }
  | { transporter?: never; failure: EmailTransportFailure };

const readProviderMessageId = (result: unknown) => {
  if (!result || typeof result !== 'object') return null;
  const messageId = (result as { messageId?: unknown }).messageId;
  return typeof messageId === 'string' ? messageId : null;
};

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
  private settingsCache: Record<string, SiteSettings> = {};

  constructor(
    private readonly settingsService: SettingsService,
    private readonly tenantConfig: TenantConfigService,
    private readonly usageMetrics: UsageMetricsService,
    @Inject(ENGAGEMENT_EMAIL_TRANSPORT_FACTORY_PORT)
    private readonly emailTransportFactory: EngagementEmailTransportFactoryPort,
    @Inject(ENGAGEMENT_SMS_GATEWAY_PORT)
    private readonly smsGateway: EngagementSmsGatewayPort,
    @Inject(ENGAGEMENT_WHATSAPP_GATEWAY_PORT)
    private readonly whatsappGateway: EngagementWhatsappGatewayPort,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
  ) {}

  private async getTransporter(emailInput: Parameters<typeof getSmtpConfigValidationIssue>[0]): Promise<EmailTransportResolution> {
    const brandId = this.getBrandId();
    const localId = this.getLocalId();
    const scopeKey = `${brandId}:${localId}`;
    const validationIssue = getSmtpConfigValidationIssue(emailInput);
    if (validationIssue) {
      this.logger.error(
        `${validationIssue.code} brandId=${brandId} localId=${localId} ${validationIssue.message}`,
      );
      this.transporterCache.delete(scopeKey);
      return {
        failure: {
          status: 'failed',
          code: validationIssue.code,
          message: validationIssue.message,
          retryable: false,
          critical: true,
        },
      };
    }

    const emailConfig = requireCompleteSmtpConfig(emailInput);
    const host = emailConfig.host;
    const port = emailConfig.port;
    const fingerprint = createHash('sha256')
      .update(`${host}\u0000${port}\u0000${emailConfig.user}\u0000${emailConfig.password}`)
      .digest('hex');
    const cached = this.transporterCache.get(scopeKey);
    if (cached?.fingerprint === fingerprint) return { transporter: cached.transporter };

    const transporter = this.emailTransportFactory.createTransport(buildSmtpTransportConfig({
      host,
      port,
      user: emailConfig.user,
      password: emailConfig.password,
    }));
    this.transporterCache.set(scopeKey, { fingerprint, transporter });
    return { transporter };
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
    const transport = await this.getTransporter(config.email);
    if (transport.failure) return transport.failure;
    const transporter = transport.transporter;
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
    const emailBranding = resolveTenantEmailBranding(config);
    const brandColor = emailBranding.accentText;
    const brandDark = emailBranding.background;
    const contactEmail = settings.contact.email || config.email?.user || 'info@leblond.com';
    const contactPhone = settings.contact.phone || '';
    const location = appointment.location || settings.location.label || 'Le Blond Hair Salon';
    const logoSrc = emailBranding.logo?.src;
    const safeBrandName = escapeEmailHtml(brandName);
    const safeContactName = escapeEmailHtml(contact.name || 'cliente');
    const safeFormattedDate = escapeEmailHtml(formattedDate);
    const safeServiceName = escapeEmailHtml(appointment.serviceName);
    const safeBarberName = escapeEmailHtml(appointment.barberName);
    const safeLocation = escapeEmailHtml(location);
    const safeContactEmail = escapeEmailHtml(contactEmail);
    const safeContactPhone = escapeEmailHtml(contactPhone);

    const html = `
      <meta name="color-scheme" content="${emailBranding.mode}" />
      <meta name="supported-color-schemes" content="${emailBranding.mode}" />
      <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; background:${brandDark}; padding:24px; color:${emailBranding.textColor}; color-scheme:${emailBranding.mode};">
        <table role="presentation" style="width:100%; max-width:640px; margin:0 auto; background:${emailBranding.cardBackground}; border-radius:16px; overflow:hidden; border:1px solid ${emailBranding.borderColor};">
          <tr style="background:${emailBranding.headerBackground}; border-top:4px solid ${emailBranding.primary}; border-bottom:1px solid ${emailBranding.borderColor};">
            <td style="padding:22px 26px;">
              ${logoSrc ? `<img src="${escapeEmailHtml(logoSrc)}" alt="${safeBrandName}" width="56" style="display:inline-block; width:56px; height:auto; max-height:56px; border:0; vertical-align:middle; margin-right:16px;" />` : ''}
              <div style="display:inline-block; vertical-align:middle; text-align:left;">
                <div style="font-weight:700; font-size:18px; color:${emailBranding.textColor};">${safeBrandName}</div>
                <div style="font-size:12px; color:${emailBranding.mutedTextColor}; text-transform:uppercase; letter-spacing:0.08em;">${action === 'cancelada' ? 'Cita cancelada' : 'Cita ' + action}</div>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              <p style="margin:0 0 12px; font-size:16px;">Hola ${safeContactName},</p>
              <p style="margin:0 0 16px; color:${emailBranding.mutedTextColor}; line-height:1.6;">
                ${action === 'cancelada'
                  ? 'Tu cita ha sido cancelada.'
                  : `Tu cita ha sido ${action}.`}
              </p>
              <div style="border:1px solid ${emailBranding.borderColor}; border-radius:12px; padding:16px; background:${emailBranding.panelBackground}; margin-bottom:16px;">
                <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:14px; color:${emailBranding.mutedTextColor}; margin-bottom:10px;">
                  <div>Fecha y hora:&nbsp;</div>
                  <div style="text-align:right; color:${brandColor}; font-weight:700;">${safeFormattedDate}</div>
                </div>
                ${
                  appointment.serviceName
                    ? `<div style="display:flex; align-items:flex-start; justify-content:space-between; gap:14px; color:${emailBranding.mutedTextColor}; margin-bottom:10px;">
                        <div>Servicio:&nbsp;</div>
                        <div style="text-align:right; color:${emailBranding.textColor}; font-weight:700;">${safeServiceName}</div>
                      </div>`
                    : ''
                }
                ${
                  appointment.barberName
                    ? `<div style="display:flex; align-items:flex-start; justify-content:space-between; gap:14px; color:${emailBranding.mutedTextColor}; margin-bottom:10px;">
                        <div>Profesional:&nbsp;</div>
                        <div style="text-align:right; color:${emailBranding.textColor}; font-weight:700;">${safeBarberName}</div>
                      </div>`
                    : ''
                }
                <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:14px; color:${emailBranding.mutedTextColor};">
                  <div>Ubicación:&nbsp;</div>
                  <div style="text-align:right; color:${emailBranding.textColor}; font-weight:700;">${safeLocation}</div>
                </div>
              </div>
              <p style="margin:0 0 12px; color:${emailBranding.mutedTextColor};">
                ${action === 'cancelada'
                  ? 'Si quieres reprogramar, contáctanos y te ayudamos.'
                  : 'Si necesitas ajustar algo de tu cita, estamos disponibles para ayudarte.'}
              </p>
              <div style="margin-top:20px; padding:14px 16px; border-radius:12px; background:${emailBranding.panelBackground}; color:${emailBranding.textColor}; border:1px solid ${emailBranding.borderColor};">
                <div style="font-weight:600; margin-bottom:4px;">Contacto</div>
                <div style="font-size:14px; color:${emailBranding.mutedTextColor};">
                  <a href="mailto:${safeContactEmail}" style="color:${emailBranding.accentText}; text-decoration:none;">${safeContactEmail}</a>
                  ${contactPhone ? `<br/><a href="https://wa.me/${contactPhone.replace(/\\D/g, '')}" style="color:${emailBranding.accentText}; text-decoration:none;">${safeContactPhone}</a>` : ''}
                </div>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px; background:${emailBranding.footerBackground}; color:${emailBranding.mutedTextColor}; border-top:1px solid ${emailBranding.borderColor}; font-size:12px; text-align:center;">
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
        attachments: getTenantEmailLogoAttachments(emailBranding),
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
    const transport = await this.getTransporter(config.email);
    if (transport.failure) return transport.failure;
    const transporter = transport.transporter;
    const settings = await this.getSettings();
    const brandName =
      settings.branding.shortName ||
      settings.branding.name ||
      config.branding?.shortName ||
      config.branding?.name ||
      'Managgio';
    const contactEmail = settings.contact.email || config.email?.user || 'info@leblond.com';
    const emailBranding = resolveTenantEmailBranding(config);
    const brandColor = emailBranding.primary;
    const brandDark = emailBranding.background;
    const logoSrc = emailBranding.logo?.src;
    const ctaLabel = escapeEmailHtml(params.ctaLabel || 'Ver mi recompensa');
    const ctaUrl = params.ctaUrl && (/^https?:\/\//i.test(params.ctaUrl) || params.ctaUrl.startsWith('/'))
      ? escapeEmailHtml(params.ctaUrl)
      : undefined;
    const safeBrandName = escapeEmailHtml(brandName);
    const safeContactName = escapeEmailHtml(params.contact.name || 'cliente');
    const safeMessage = escapeEmailHtml(params.message).replace(/\n/g, '<br/>');
    const safeContactEmail = escapeEmailHtml(contactEmail);

    const html = `
      <meta name="color-scheme" content="${emailBranding.mode}" />
      <meta name="supported-color-schemes" content="${emailBranding.mode}" />
      <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; background:${brandDark}; padding:24px; color:${emailBranding.textColor}; color-scheme:${emailBranding.mode};">
        <table role="presentation" style="width:100%; max-width:640px; margin:0 auto; background:${emailBranding.cardBackground}; border-radius:16px; overflow:hidden; border:1px solid ${emailBranding.borderColor};">
          <tr style="background:${emailBranding.headerBackground}; border-top:4px solid ${emailBranding.primary}; border-bottom:1px solid ${emailBranding.borderColor};">
            <td style="padding:22px 26px;">
              ${logoSrc ? `<img src="${escapeEmailHtml(logoSrc)}" alt="${safeBrandName}" width="56" style="display:inline-block; width:56px; height:auto; max-height:56px; border:0; vertical-align:middle; margin-right:16px;" />` : ''}
              <div style="display:inline-block; vertical-align:middle; text-align:left;">
                <div style="font-weight:700; font-size:18px; color:${emailBranding.textColor};">${safeBrandName}</div>
                <div style="font-size:12px; color:${emailBranding.mutedTextColor}; text-transform:uppercase; letter-spacing:0.08em;">Programa de referidos</div>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              <p style="margin:0 0 12px; font-size:16px;">Hola ${safeContactName},</p>
              <p style="margin:0 0 16px; color:${emailBranding.mutedTextColor}; line-height:1.6;">
                ${safeMessage}
              </p>
              ${
                ctaUrl
                  ? `<div style="margin-top:20px;">
                      <a href="${ctaUrl}" style="display:inline-block; padding:12px 18px; border-radius:999px; background:${brandColor}; color:${emailBranding.primaryForeground}; text-decoration:none; font-weight:600;">
                        ${ctaLabel}
                      </a>
                    </div>`
                  : ''
              }
              <div style="margin-top:20px; padding:14px 16px; border-radius:12px; background:${emailBranding.panelBackground}; color:${emailBranding.textColor}; border:1px solid ${emailBranding.borderColor};">
                <div style="font-weight:600; margin-bottom:4px;">Contacto</div>
                <div style="font-size:14px; color:${emailBranding.mutedTextColor};">
                  <a href="mailto:${safeContactEmail}" style="color:${emailBranding.accentText}; text-decoration:none;">${safeContactEmail}</a>
                </div>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px; background:${emailBranding.footerBackground}; color:${emailBranding.mutedTextColor}; border-top:1px solid ${emailBranding.borderColor}; font-size:12px; text-align:center;">
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
        attachments: getTenantEmailLogoAttachments(emailBranding),
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
    const to = params.contact.email?.trim();
    if (!to) {
      return { status: 'skipped', code: 'EMAIL_RECIPIENT_MISSING', message: 'No recipient email is available.' };
    }
    const transport = await this.getTransporter(config.email);
    if (transport.failure) return transport.failure;
    const transporter = transport.transporter;
    const settings = await this.getSettings();
    const brandName =
      settings.branding.shortName ||
      settings.branding.name ||
      config.branding?.shortName ||
      config.branding?.name ||
      'Managgio';
    const emailBranding = resolveTenantEmailBranding(config);
    const safeMessage = escapeEmailHtml(params.message).replace(/\n/g, '<br/>');
    const html = renderBrandedEmail({
      branding: emailBranding,
      brandName,
      eyebrow: 'Comunicado',
      bodyHtml: `<div style="color:${emailBranding.textColor}; font-size:15px; line-height:1.65;">${safeMessage}</div>`,
      footerText: `© ${new Date().getFullYear()} ${brandName}.`,
    });

    try {
      const result = await transporter.sendMail({
        from: `"${config.email?.fromName || brandName}" <${config.email?.user}>`,
        to,
        subject: params.subject,
        text: params.message,
        html,
        attachments: getTenantEmailLogoAttachments(emailBranding),
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

  async sendReminderSms(
    contact: EngagementNotificationContactInfo,
    appointment: EngagementNotificationAppointmentInfo,
    context?: EngagementNotificationDeliveryContext,
  ) {
    const brandName = await this.resolveBrandName();
    const formattedDate = this.formatReminderSmsDate(appointment.date);
    const message = buildSmsReminderMessage({
      brandName,
      formattedDate,
      serviceName: appointment.serviceName,
      managementUrl: appointment.managementUrl,
    });
    return this.sendSmsMessage(contact, message.body, context);
  }

  sendBroadcastSms(params: {
    contact: EngagementNotificationContactInfo;
    message: string;
  }, context?: EngagementNotificationDeliveryContext) {
    return this.sendSmsMessage(params.contact, params.message, context);
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
    context?: EngagementNotificationDeliveryContext,
  ): Promise<EngagementNotificationDeliveryResult> {
    const config = await this.tenantConfig.getEffectiveConfig();
    if (config.notificationPrefs?.sms === false) {
      return { status: 'skipped', code: 'SMS_DISABLED', message: 'SMS notifications are disabled for this tenant.' };
    }
    if (!canSendRoutineSms(process.env.NODE_ENV)) {
      return {
        status: 'skipped',
        code: 'SMS_ROUTINE_DELIVERY_DISABLED',
        message: 'Routine SMS delivery is disabled outside production.',
      };
    }
    if (!contact.phone) {
      return { status: 'skipped', code: 'PHONE_RECIPIENT_MISSING', message: 'No recipient phone is available.' };
    }
    const normalizedPhone = normalizeSmsRecipient(contact.phone);
    if (!normalizedPhone) {
      return {
        status: 'failed',
        code: 'PHONE_RECIPIENT_INVALID',
        message: 'The recipient phone must use international format.',
        retryable: false,
        critical: false,
      };
    }
    const segmentation = analyzeSmsSegmentation(body);
    if (segmentation.segments > SMS_MAX_STANDARD_SEGMENTS) {
      return {
        status: 'failed',
        code: 'SMS_MESSAGE_TOO_LONG',
        message: `SMS messages are limited to ${SMS_MAX_STANDARD_SEGMENTS} segments.`,
        retryable: false,
        critical: false,
      };
    }
    const result = await this.smsGateway.send({
      to: normalizedPhone,
      body,
      purpose: 'routine',
      deliveryReference: context?.deliveryAttemptReference,
    });
    if (result.status === 'accepted') {
      this.recordSmsUsage(result);
      return { status: 'accepted', providerMessageId: result.providerMessageId };
    }
    this.logger.error(
      `${result.code} brandId=${this.getBrandId()} localId=${this.getLocalId()} ${result.message}`,
    );
    return result;
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
    const normalizedPhone = normalizeSmsRecipient(contact.phone);
    if (!normalizedPhone) {
      return {
        status: 'failed',
        code: 'PHONE_RECIPIENT_INVALID',
        message: 'The recipient phone must use international format.',
        retryable: false,
        critical: false,
      };
    }
    const result = await this.whatsappGateway.send({
      to: normalizedPhone,
      body,
      templateData,
    });
    if (result.status === 'accepted') {
      this.recordWhatsappUsage(result);
      return { status: 'accepted', providerMessageId: result.providerMessageId };
    }
    this.logger.error(
      `${result.code} brandId=${this.getBrandId()} localId=${this.getLocalId()} ${result.message}`,
    );
    return result;
  }

  private recordSmsUsage(result: Extract<EngagementSmsGatewayResult, { status: 'accepted' }>) {
    const costUsd = result.cost?.currency === 'USD' ? result.cost.amount : null;
    void this.usageMetrics.recordSmsUsage(
      costUsd === null ? { messages: 1 } : { costUsd, messages: 1 },
    ).catch(() => {
      this.logger.warn(
        `MESSAGING_USAGE_RECORD_FAILED brandId=${this.getBrandId()} localId=${this.getLocalId()} channel=sms`,
      );
    });
  }

  private recordWhatsappUsage(result: Extract<EngagementWhatsappGatewayResult, { status: 'accepted' }>) {
    const costUsd = result.cost?.currency === 'USD' ? result.cost.amount : null;
    void this.usageMetrics.recordWhatsappUsage(
      costUsd === null ? { messages: 1 } : { costUsd, messages: 1 },
    ).catch(() => {
      this.logger.warn(
        `MESSAGING_USAGE_RECORD_FAILED brandId=${this.getBrandId()} localId=${this.getLocalId()} channel=whatsapp`,
      );
    });
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

  private formatDateTime(value: Date) {
    const dateValue = value.toLocaleDateString('es-ES', {
      timeZone: this.getTimezone(),
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const timeValue = value.toLocaleTimeString('es-ES', {
      timeZone: this.getTimezone(),
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

  private formatAppointmentEmailDate(value: Date) {
    return value.toLocaleString('es-ES', {
      timeZone: this.getTimezone(),
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
    const date = value.toLocaleDateString('es-ES', {
      timeZone: this.getTimezone(),
      day: '2-digit',
      month: '2-digit',
    });
    const time = value.toLocaleTimeString('es-ES', {
      timeZone: this.getTimezone(),
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return `${date} a las ${time}`;
  }

  private getTimezone() {
    const timezone = this.tenantContextPort.getRequestContext().timezone?.trim();
    if (!timezone) return APP_TIMEZONE;
    try {
      new Intl.DateTimeFormat('es-ES', { timeZone: timezone }).format();
      return timezone;
    } catch {
      return APP_TIMEZONE;
    }
  }
}
