import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import twilio from 'twilio';

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
  private readonly transporter: nodemailer.Transporter | null;
  private readonly twilioClient: twilio.Twilio | null;
  private readonly messagingServiceSid: string | null;

  constructor(private readonly configService: ConfigService) {
    const emailUser = this.configService.get<string>('EMAIL');
    const emailPass = this.configService.get<string>('PASSWORD');
    const emailHost = this.configService.get<string>('EMAIL_HOST') || 'smtp.gmail.com';
    const emailPort = Number(this.configService.get<string>('EMAIL_PORT')) || 587;

    if (emailUser && emailPass) {
      this.transporter = nodemailer.createTransport({
        host: emailHost,
        port: emailPort,
        secure: emailPort === 465,
        auth: {
          user: emailUser,
          pass: emailPass,
        },
      });
    } else {
      this.logger.warn('Email credentials missing, email notifications disabled');
      this.transporter = null;
    }

    const accountSid = this.configService.get<string>('TWILIO_AUTH_SID') || this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_ACCOUNT_TOKEN') || this.configService.get<string>('TWILIO_AUTH_TOKEN');
    const messagingServiceSid = this.configService.get<string>('TWILIO_MESSAGING_SERVICE_SID');

    if (accountSid && authToken && messagingServiceSid) {
      this.twilioClient = twilio(accountSid, authToken);
      this.messagingServiceSid = messagingServiceSid;
    } else {
      this.logger.warn('Twilio credentials missing, SMS reminders disabled');
      this.twilioClient = null;
      this.messagingServiceSid = null;
    }
  }

  async sendAppointmentEmail(contact: ContactInfo, appointment: AppointmentInfo, action: 'creada' | 'actualizada' | 'cancelada') {
    if (!this.transporter || !contact.email) return;
    const formattedDate = appointment.date.toLocaleString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const subject = action === 'cancelada' ? 'Tu cita ha sido cancelada' : `Tu cita ha sido ${action}`;
    const lines = [
      `Hola ${contact.name || ''}`.trim(),
      action === 'cancelada'
        ? 'Tu cita ha sido cancelada.'
        : `Tu cita ha sido ${action}.`,
      `Fecha y hora: ${formattedDate}.`,
    ];
    if (appointment.serviceName) lines.push(`Servicio: ${appointment.serviceName}.`);
    if (appointment.barberName) lines.push(`Barbero: ${appointment.barberName}.`);
    if (appointment.location) lines.push(`Lugar: ${appointment.location}.`);
    lines.push(
      action === 'cancelada'
        ? 'Si quieres reprogramar, contáctanos y te ayudamos.'
        : 'Si necesitas cambiar algo, contáctanos.',
    );

    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('EMAIL'),
        to: contact.email,
        subject,
        text: lines.join('\n'),
      });
    } catch (error) {
      this.logger.error(`Error sending email to ${contact.email}: ${error}`);
    }
  }

  async sendReminderSms(contact: ContactInfo, appointment: AppointmentInfo) {
    if (!this.twilioClient || !this.messagingServiceSid || !contact.phone) return;
    const formattedDate = appointment.date.toLocaleString('es-ES', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    const message = `Recordatorio: cita ${formattedDate}${appointment.serviceName ? ' - ' + appointment.serviceName : ''}. Si no puedes asistir, avísanos.`;

    try {
      await this.twilioClient.messages.create({
        messagingServiceSid: this.messagingServiceSid,
        to: contact.phone,
        body: message,
      });
    } catch (error) {
      this.logger.error(`Error sending SMS to ${contact.phone}: ${error}`);
    }
  }
}
