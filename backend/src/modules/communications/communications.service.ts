import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CommunicationCampaign,
  CommunicationChannel,
  CommunicationExecutionMode,
  CommunicationExecutionStatus,
  CommunicationRecipientStatus,
  CommunicationStatus,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { AppointmentsFacade } from '../appointments/appointments.facade';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantConfigService } from '../../tenancy/tenant-config.service';
import {
  DISTRIBUTED_LOCK_PORT,
  DistributedLockPort,
} from '../../shared/application/distributed-lock.port';
import {
  APP_TIMEZONE,
  endOfDayInTimeZone,
  getWeekdayKey,
  makeDateInTimeZone,
  startOfDayInTimeZone,
} from '../../utils/timezone';
import { DEFAULT_SHOP_SCHEDULE, DayKey } from '../schedules/schedule.types';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../contexts/platform/ports/outbound/tenant-context.port';
import { COMMUNICATION_CHANNELS, COMMUNICATION_TEMPLATE_KEYS } from './communications.constants';
import { CreateCommunicationDto } from './dto/create-communication.dto';
import { CommunicationPayloadDto } from './dto/communication-payload.dto';
import { ExecuteCommunicationDto } from './dto/execute-communication.dto';
import { ListCommunicationsDto } from './dto/list-communications.dto';
import { PreviewCommunicationDto } from './dto/preview-communication.dto';
import { UpdateChannelPreferenceDto } from './dto/update-channel-preference.dto';
import { UpdateCommunicationDraftDto } from './dto/update-communication-draft.dto';

type AppointmentScopeRecord = {
  id: string;
  userId: string | null;
  guestName: string | null;
  guestContact: string | null;
  status: string;
  startDateTime: Date;
  user: { id: string; name: string; email: string; phone: string | null } | null;
  barber: { name: string } | null;
  service: { name: string } | null;
};

type RecipientTarget = {
  recipientKey: string;
  userId: string | null;
  appointmentId: string | null;
  recipientName: string;
  email: string | null;
  phone: string | null;
  appointmentDate: Date | null;
  serviceName: string | null;
  barberName: string | null;
};

type ShiftType = 'morning' | 'afternoon';

type PreviewComputation = {
  publicPreview: {
    actionType: string;
    scopeType: string;
    channel: string;
    scheduledFor: string | null;
    appointmentsAffected: number;
    clientsAffected: number;
    cancellations: number;
    withoutValidContact: number;
    excludedAlreadyNotified: number;
    invalidRecipients: Array<{ recipientKey: string; recipientName: string; reason: string }>;
    excludedRecipients: Array<{ recipientKey: string; recipientName: string }>;
    messagePreview: { title: string; subject: string; body: string };
    createHoliday: unknown | null;
  };
  deliverableTargets: RecipientTarget[];
  excludedTargets: RecipientTarget[];
  cancellableAppointments: number;
};

const COMMUNICATION_TEMPLATES: Array<{
  key: (typeof COMMUNICATION_TEMPLATE_KEYS)[number];
  title: string;
  subject: string;
  message: string;
}> = [
  {
    key: 'medical_leave',
    title: 'Baja médica / indisponibilidad',
    subject: 'Actualización de tu cita en {{local}}',
    message:
      'Hola {{clientName}},\n\nTe escribimos desde {{local}} para informarte de una indisponibilidad médica del profesional {{professional}}.\n\nTu cita del {{date}} a las {{time}} necesita ser reprogramada.\n\nGracias por tu comprensión.',
  },
  {
    key: 'local_closure',
    title: 'Cierre puntual del local',
    subject: '{{local}} permanecerá cerrado temporalmente',
    message:
      'Hola {{clientName}},\n\nPor una incidencia operativa, {{local}} permanecerá cerrado en la fecha prevista.\n\nTu cita del {{date}} a las {{time}} se ha visto afectada.\n\nContacta con nosotros para darte una nueva cita prioritaria.',
  },
  {
    key: 'delay_incident',
    title: 'Retraso o incidencia',
    subject: 'Aviso importante sobre tu atención en {{local}}',
    message:
      'Hola {{clientName}},\n\nEstamos sufriendo un retraso operativo en {{local}}.\n\nTu franja prevista es {{date}} a las {{time}} con {{professional}}.\n\nTe pedimos disculpas y te mantendremos informado.',
  },
  {
    key: 'organizational_change',
    title: 'Cambio organizativo',
    subject: 'Cambios organizativos en {{local}}',
    message:
      'Hola {{clientName}},\n\nHemos realizado un ajuste organizativo en {{local}} que afecta a la agenda de {{professional}}.\n\nReferencia de cita: {{date}} {{time}}.\n\nGracias por tu confianza.',
  },
  {
    key: 'general_announcement',
    title: 'Comunicado general',
    subject: 'Comunicado de {{local}}',
    message:
      'Hola {{clientName}},\n\nQueremos compartirte un comunicado importante de {{local}}.\n\nGracias por seguir confiando en nosotros.',
  },
];

@Injectable()
export class CommunicationsService {
  private readonly logger = new Logger(CommunicationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly appointmentsFacade: AppointmentsFacade,
    private readonly auditLogsService: AuditLogsService,
    private readonly tenantConfigService: TenantConfigService,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
    @Inject(DISTRIBUTED_LOCK_PORT)
    private readonly distributedLockPort: DistributedLockPort,
  ) {}

  async list(dto: ListCommunicationsDto) {
    const { localId } = this.getTenantContext();
    const page = Math.max(1, parseInt(dto.page || '1', 10) || 1);
    const pageSize = Math.min(50, Math.max(10, parseInt(dto.pageSize || '20', 10) || 20));
    const status =
      typeof dto.status === 'string' && dto.status.trim()
        ? (dto.status.trim() as CommunicationStatus)
        : undefined;
    const where: Prisma.CommunicationCampaignWhereInput = {
      localId,
      ...(status ? { status } : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.communicationCampaign.count({ where }),
      this.prisma.communicationCampaign.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          createdByUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          executions: {
            orderBy: [{ startedAt: 'desc' }],
            take: 1,
          },
        },
      }),
    ]);

    return {
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
      items: items.map((item) => this.mapCampaign(item)),
    };
  }

  async getDetail(campaignId: string) {
    const campaign = await this.findCampaignOrThrow(campaignId);
    const executions = await this.prisma.communicationExecution.findMany({
      where: { campaignId },
      orderBy: [{ startedAt: 'desc' }],
      include: {
        initiatedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
    const recipientResults = await this.prisma.communicationRecipientResult.findMany({
      where: { campaignId },
      orderBy: [{ createdAt: 'desc' }],
      take: 500,
    });

    return {
      ...this.mapCampaign(campaign),
      executions,
      recipientResults,
    };
  }

  getTemplates() {
    return COMMUNICATION_TEMPLATES;
  }

  async getChannelPreference() {
    const { localId } = this.getTenantContext();
    const current = await this.prisma.communicationChannelPreference.findUnique({
      where: { localId },
      select: { preferredChannel: true },
    });
    return {
      channel: (current?.preferredChannel || 'email') as CommunicationChannel,
    };
  }

  async updateChannelPreference(dto: UpdateChannelPreferenceDto, actorUserId?: string | null) {
    const { localId } = this.getTenantContext();
    const saved = await this.prisma.communicationChannelPreference.upsert({
      where: { localId },
      create: {
        localId,
        preferredChannel: dto.channel as CommunicationChannel,
        updatedByUserId: actorUserId || null,
      },
      update: {
        preferredChannel: dto.channel as CommunicationChannel,
        updatedByUserId: actorUserId || null,
      },
    });
    return { channel: saved.preferredChannel };
  }

  async preview(dto: PreviewCommunicationDto) {
    await this.ensureFeatureEnabled();
    const preview = await this.computePreview(dto);
    return preview.publicPreview;
  }

  async create(dto: CreateCommunicationDto, actorUserId?: string | null) {
    await this.ensureFeatureEnabled();
    this.validatePayloadRules(dto, true);
    const preview = await this.computePreview(dto);
    const { brandId, localId } = this.getTenantContext();
    const runImmediately = this.shouldRunImmediately(dto);
    if (!runImmediately && !dto.saveAsDraft && !dto.scheduleAt) {
      throw new BadRequestException('Debes guardar como borrador, programar o ejecutar de inmediato.');
    }
    const scheduledFor = dto.scheduleAt ? new Date(dto.scheduleAt) : null;

    const created = await this.prisma.communicationCampaign.create({
      data: {
        brandId,
        localId,
        createdByUserId: actorUserId || null,
        actionType: dto.actionType as any,
        scopeType: dto.scopeType as any,
        channel: dto.channel as any,
        templateKey: dto.templateKey as any,
        status: runImmediately
          ? CommunicationStatus.running
          : dto.saveAsDraft
            ? CommunicationStatus.draft
            : CommunicationStatus.scheduled,
        title: dto.title.trim(),
        subject: (dto.subject || '').trim() || null,
        message: dto.message.trim(),
        internalNote: (dto.internalNote || '').trim() || null,
        scopeConfig: dto.scopeCriteria as Prisma.JsonObject,
        options: (dto.extraOptions || {}) as Prisma.JsonObject,
        impactSummary: preview.publicPreview as Prisma.JsonObject,
        scheduledFor,
      },
    });

    await this.logAudit('communications.campaign.created', created.id, actorUserId, {
      status: created.status,
      actionType: created.actionType,
      scopeType: created.scopeType,
      channel: created.channel,
      scheduledFor: created.scheduledFor?.toISOString() || null,
    });

    await this.persistChannelPreference(dto.channel as CommunicationChannel, actorUserId || null);

    if (!runImmediately) {
      return this.getDetail(created.id);
    }

    const execution = await this.executeCampaignInternal(
      created.id,
      {
        idempotencyKey: dto.idempotencyKey,
        actorUserId,
        mode: CommunicationExecutionMode.immediate,
      },
    );
    return execution;
  }

  async updateDraft(campaignId: string, dto: UpdateCommunicationDraftDto, actorUserId?: string | null) {
    await this.ensureFeatureEnabled();
    const campaign = await this.findCampaignOrThrow(campaignId);
    if (campaign.status !== CommunicationStatus.draft && campaign.status !== CommunicationStatus.scheduled) {
      throw new BadRequestException('Solo puedes editar borradores o comunicados programados.');
    }

    const payload: CommunicationPayloadDto = {
      actionType: (dto.actionType || campaign.actionType) as any,
      scopeType: (dto.scopeType || campaign.scopeType) as any,
      scopeCriteria: (dto.scopeCriteria || (campaign.scopeConfig as any) || {}) as any,
      templateKey: (dto.templateKey || campaign.templateKey) as any,
      channel: (dto.channel || campaign.channel) as any,
      title: dto.title ?? campaign.title,
      subject: dto.subject ?? campaign.subject ?? undefined,
      message: dto.message ?? campaign.message,
      internalNote: dto.internalNote ?? campaign.internalNote ?? undefined,
      scheduleAt:
        dto.scheduleAt !== undefined
          ? dto.scheduleAt
          : campaign.scheduledFor
            ? campaign.scheduledFor.toISOString()
            : undefined,
      extraOptions: (dto.extraOptions || (campaign.options as any) || {}) as any,
    };

    this.validatePayloadRules(payload, true);
    const preview = await this.computePreview(payload);
    const nextStatus = payload.scheduleAt ? CommunicationStatus.scheduled : CommunicationStatus.draft;

    await this.prisma.communicationCampaign.update({
      where: { id: campaignId, localId: campaign.localId },
      data: {
        actionType: payload.actionType as any,
        scopeType: payload.scopeType as any,
        channel: payload.channel as any,
        templateKey: payload.templateKey as any,
        title: payload.title.trim(),
        subject: (payload.subject || '').trim() || null,
        message: payload.message.trim(),
        internalNote: (payload.internalNote || '').trim() || null,
        scopeConfig: payload.scopeCriteria as Prisma.JsonObject,
        options: (payload.extraOptions || {}) as Prisma.JsonObject,
        impactSummary: preview.publicPreview as Prisma.JsonObject,
        status: nextStatus,
        scheduledFor: payload.scheduleAt ? new Date(payload.scheduleAt) : null,
      },
    });
    await this.persistChannelPreference(payload.channel as CommunicationChannel, actorUserId || null);

    await this.logAudit('communications.campaign.updated', campaignId, actorUserId, {
      status: nextStatus,
    });

    return this.getDetail(campaignId);
  }

  async duplicate(campaignId: string, actorUserId?: string | null) {
    await this.ensureFeatureEnabled();
    const campaign = await this.findCampaignOrThrow(campaignId);
    const duplicated = await this.prisma.communicationCampaign.create({
      data: {
        brandId: campaign.brandId,
        localId: campaign.localId,
        createdByUserId: actorUserId || null,
        originCampaignId: campaign.originCampaignId || campaign.id,
        actionType: campaign.actionType,
        scopeType: campaign.scopeType,
        channel: campaign.channel,
        templateKey: campaign.templateKey,
        status: CommunicationStatus.draft,
        title: campaign.title,
        subject: campaign.subject,
        message: campaign.message,
        internalNote: campaign.internalNote,
        scopeConfig: (campaign.scopeConfig ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        options: (campaign.options ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        impactSummary: (campaign.impactSummary ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });
    await this.logAudit('communications.campaign.duplicated', duplicated.id, actorUserId, {
      sourceCampaignId: campaignId,
    });
    return this.getDetail(duplicated.id);
  }

  async cancelScheduled(campaignId: string, actorUserId?: string | null) {
    await this.ensureFeatureEnabled();
    const campaign = await this.findCampaignOrThrow(campaignId);
    if (campaign.status !== CommunicationStatus.scheduled) {
      throw new BadRequestException('Solo puedes cancelar comunicados programados.');
    }
    await this.prisma.communicationCampaign.update({
      where: { id: campaign.id, localId: campaign.localId },
      data: {
        status: CommunicationStatus.cancelled,
        cancelledAt: new Date(),
      },
    });
    await this.logAudit('communications.campaign.cancelled', campaign.id, actorUserId, {
      previousStatus: campaign.status,
    });
    return this.getDetail(campaign.id);
  }

  async execute(campaignId: string, dto: ExecuteCommunicationDto, actorUserId?: string | null) {
    await this.ensureFeatureEnabled();
    return this.executeCampaignInternal(campaignId, {
      idempotencyKey: dto.idempotencyKey,
      actorUserId,
      mode: CommunicationExecutionMode.immediate,
    });
  }

  async runScheduledDueCampaigns() {
    const config = await this.tenantConfigService.getEffectiveConfig();
    if (config.features?.communicationsEnabled !== true) {
      return { processed: 0 };
    }
    const { localId } = this.getTenantContext();
    const dueCampaigns = await this.prisma.communicationCampaign.findMany({
      where: {
        localId,
        status: CommunicationStatus.scheduled,
        scheduledFor: {
          lte: new Date(),
        },
      },
      select: { id: true },
      orderBy: [{ scheduledFor: 'asc' }],
      take: 20,
    });
    for (const campaign of dueCampaigns) {
      try {
        await this.executeCampaignInternal(campaign.id, {
          mode: CommunicationExecutionMode.scheduled,
        });
      } catch (error) {
        this.logger.warn(
          `Scheduled communication failed campaignId=${campaign.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    return { processed: dueCampaigns.length };
  }

  private async executeCampaignInternal(
    campaignId: string,
    options: {
      idempotencyKey?: string | null;
      actorUserId?: string | null;
      mode: CommunicationExecutionMode;
    },
  ) {
    let output: unknown = null;
    const lockKey = `communications:execute:${campaignId}`;
    const executed = await this.distributedLockPort.runWithLock(
      lockKey,
      async () => {
        output = await this.executeUnderLock(campaignId, options);
      },
      {
        ttlMs: 3 * 60_000,
        waitMs: 5_000,
        retryEveryMs: 400,
        onLockedMessage: `Skipping concurrent communication execution campaignId=${campaignId}`,
      },
    );
    if (!executed) {
      throw new BadRequestException('Este comunicado se está procesando en otro proceso.');
    }
    return output;
  }

  private async executeUnderLock(
    campaignId: string,
    options: {
      idempotencyKey?: string | null;
      actorUserId?: string | null;
      mode: CommunicationExecutionMode;
    },
  ) {
    const campaign = await this.findCampaignOrThrow(campaignId);
    if (campaign.status === CommunicationStatus.cancelled) {
      throw new BadRequestException('El comunicado está cancelado.');
    }
    if (campaign.status === CommunicationStatus.completed && options.mode === CommunicationExecutionMode.immediate) {
      throw new BadRequestException('El comunicado ya se ejecutó.');
    }

    const idempotencyKey = (options.idempotencyKey || '').trim() || randomUUID();
    const existingExecution = await this.prisma.communicationExecution.findUnique({
      where: {
        campaignId_idempotencyKey: {
          campaignId: campaign.id,
          idempotencyKey,
        },
      },
    });
    if (existingExecution) {
      return this.getDetail(campaign.id);
    }

    const payload = this.payloadFromCampaign(campaign);
    this.validatePayloadRules(payload, false);
    const preview = await this.computePreview(payload);
    const now = new Date();

    const execution = await this.prisma.communicationExecution.create({
      data: {
        campaignId: campaign.id,
        localId: campaign.localId,
        initiatedByUserId: options.actorUserId || campaign.createdByUserId || null,
        mode: options.mode,
        idempotencyKey,
        status: CommunicationExecutionStatus.running,
      },
    });
    await this.prisma.communicationCampaign.update({
      where: { id: campaign.id },
      data: {
        status: CommunicationStatus.running,
      },
    });

    const localName = await this.resolveLocalName(campaign.localId);
    const recipientRows: Prisma.CommunicationRecipientResultCreateManyInput[] = [];
    let sent = 0;
    let failed = 0;
    let cancelled = 0;
    let excluded = 0;
    let skipped = 0;

    for (const target of preview.excludedTargets) {
      excluded += 1;
      recipientRows.push({
        campaignId: campaign.id,
        executionId: execution.id,
        localId: campaign.localId,
        userId: target.userId,
        appointmentId: target.appointmentId,
        recipientKey: target.recipientKey,
        recipientName: target.recipientName,
        recipientEmail: target.email,
        recipientPhone: target.phone,
        channel: campaign.channel,
        status: CommunicationRecipientStatus.excluded,
        excludedAlreadyNotified: true,
        cancelledAppointment: false,
        createdAt: now,
        updatedAt: now,
      });
    }

    for (const target of preview.deliverableTargets) {
      let cancelledAppointment = false;
      if (campaign.actionType === 'comunicar_y_cancelar' && target.appointmentId) {
        try {
          await this.appointmentsFacade.update(
            target.appointmentId,
            { status: 'cancelled' },
            { actorUserId: options.actorUserId || campaign.createdByUserId || null },
          );
          cancelledAppointment = true;
          cancelled += 1;
        } catch (error) {
          failed += 1;
          recipientRows.push({
            campaignId: campaign.id,
            executionId: execution.id,
            localId: campaign.localId,
            userId: target.userId,
            appointmentId: target.appointmentId,
            recipientKey: target.recipientKey,
            recipientName: target.recipientName,
            recipientEmail: target.email,
            recipientPhone: target.phone,
            channel: campaign.channel,
            status: CommunicationRecipientStatus.failed,
            errorCode: 'appointment_not_cancellable',
            errorMessage: error instanceof Error ? error.message : 'No se pudo cancelar la cita.',
            excludedAlreadyNotified: false,
            cancelledAppointment: false,
            createdAt: now,
            updatedAt: now,
          });
          continue;
        }
      }

      const invalidReason = this.getMissingChannelReason(campaign.channel, target);
      if (invalidReason) {
        failed += 1;
        recipientRows.push({
          campaignId: campaign.id,
          executionId: execution.id,
          localId: campaign.localId,
          userId: target.userId,
          appointmentId: target.appointmentId,
          recipientKey: target.recipientKey,
          recipientName: target.recipientName,
          recipientEmail: target.email,
          recipientPhone: target.phone,
          channel: campaign.channel,
          status: CommunicationRecipientStatus.failed,
          errorCode: invalidReason,
          errorMessage: 'No hay dato de contacto válido para el canal seleccionado.',
          excludedAlreadyNotified: false,
          cancelledAppointment,
          createdAt: now,
          updatedAt: now,
        });
        continue;
      }

      try {
        const rendered = this.renderCampaignMessage(campaign, target, localName);
        await this.sendThroughChannel(campaign.channel, target, rendered);
        sent += 1;
        recipientRows.push({
          campaignId: campaign.id,
          executionId: execution.id,
          localId: campaign.localId,
          userId: target.userId,
          appointmentId: target.appointmentId,
          recipientKey: target.recipientKey,
          recipientName: target.recipientName,
          recipientEmail: target.email,
          recipientPhone: target.phone,
          channel: campaign.channel,
          status: CommunicationRecipientStatus.sent,
          excludedAlreadyNotified: false,
          cancelledAppointment,
          notifiedAt: new Date(),
          createdAt: now,
          updatedAt: now,
        });
      } catch (error) {
        failed += 1;
        recipientRows.push({
          campaignId: campaign.id,
          executionId: execution.id,
          localId: campaign.localId,
          userId: target.userId,
          appointmentId: target.appointmentId,
          recipientKey: target.recipientKey,
          recipientName: target.recipientName,
          recipientEmail: target.email,
          recipientPhone: target.phone,
          channel: campaign.channel,
          status: CommunicationRecipientStatus.failed,
          errorCode: 'channel_send_error',
          errorMessage: error instanceof Error ? error.message : 'No se pudo enviar el comunicado.',
          excludedAlreadyNotified: false,
          cancelledAppointment,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    if (recipientRows.length > 0) {
      await this.prisma.communicationRecipientResult.createMany({
        data: recipientRows,
      });
    }

    let executionStatus: CommunicationExecutionStatus = CommunicationExecutionStatus.completed;
    if (sent === 0 && failed > 0) executionStatus = CommunicationExecutionStatus.failed;
    else if (failed > 0 || excluded > 0 || skipped > 0) executionStatus = CommunicationExecutionStatus.partial;

    const campaignStatus = this.mapExecutionToCampaignStatus(executionStatus);
    const summary = {
      sent,
      failed,
      cancelled,
      excluded,
      skipped,
      totalTargets: preview.deliverableTargets.length + preview.excludedTargets.length,
      channel: campaign.channel,
      mode: options.mode,
    };

    const updatedExecution = await this.prisma.communicationExecution.update({
      where: { id: execution.id },
      data: {
        status: executionStatus,
        summary: summary as Prisma.JsonObject,
        finishedAt: new Date(),
      },
    });

    const campaignUpdateData: Prisma.CommunicationCampaignUpdateInput = {
      status: campaignStatus,
      executedAt: new Date(),
      impactSummary: preview.publicPreview as Prisma.JsonObject,
      resultSummary: summary as Prisma.JsonObject,
    };

    const createdHoliday = await this.tryCreateHolidayFromOptions(campaign, payload.extraOptions?.createHoliday);
    if (createdHoliday?.generalHolidayId) {
      campaignUpdateData.holidayGeneral = {
        connect: { id: createdHoliday.generalHolidayId },
      };
    }
    if (createdHoliday?.barberHolidayId) {
      campaignUpdateData.holidayBarber = {
        connect: { id: createdHoliday.barberHolidayId },
      };
    }

    await this.prisma.communicationCampaign.update({
      where: { id: campaign.id },
      data: campaignUpdateData,
    });

    await this.logAudit('communications.campaign.executed', campaign.id, options.actorUserId, {
      executionId: updatedExecution.id,
      executionStatus,
      summary,
    });

    return this.getDetail(campaign.id);
  }

  private payloadFromCampaign(campaign: CommunicationCampaign): CommunicationPayloadDto {
    return {
      actionType: campaign.actionType as any,
      scopeType: campaign.scopeType as any,
      scopeCriteria: ((campaign.scopeConfig || {}) as any) || {},
      templateKey: campaign.templateKey as any,
      channel: campaign.channel as any,
      title: campaign.title,
      subject: campaign.subject || undefined,
      message: campaign.message,
      internalNote: campaign.internalNote || undefined,
      scheduleAt: campaign.scheduledFor?.toISOString(),
      extraOptions: ((campaign.options || {}) as any) || {},
    };
  }

  private async computePreview(payload: CommunicationPayloadDto): Promise<PreviewComputation> {
    const { localId } = this.getTenantContext();
    const targetsFromScope = await this.resolveTargets(payload, localId);
    const split = await this.excludeAlreadyNotified(
      localId,
      payload.channel as CommunicationChannel,
      targetsFromScope.targets,
      payload.extraOptions?.excludeAlreadyNotified === true,
    );
    const invalidRecipients = split.deliverableTargets
      .map((target) => ({
        target,
        reason: this.getMissingChannelReason(payload.channel as CommunicationChannel, target),
      }))
      .filter((entry) => Boolean(entry.reason)) as Array<{ target: RecipientTarget; reason: string }>;
    const cancellableAppointments = split.deliverableTargets.filter(
      (target) => payload.actionType === 'comunicar_y_cancelar' && Boolean(target.appointmentId),
    ).length;

    const sampleTarget = split.deliverableTargets.find((target) => !this.getMissingChannelReason(payload.channel as CommunicationChannel, target))
      || split.deliverableTargets[0]
      || split.excludedTargets[0]
      || null;
    const renderedPreview = this.renderCampaignMessage(
      {
        title: payload.title,
        subject: payload.subject || payload.title,
        message: payload.message,
      } as any,
      sampleTarget || {
        recipientName: 'Cliente',
        appointmentDate: null,
        serviceName: null,
        barberName: null,
      },
      await this.resolveLocalName(localId),
    );

    const publicPreview: PreviewComputation['publicPreview'] = {
      actionType: payload.actionType,
      scopeType: payload.scopeType,
      channel: payload.channel,
      scheduledFor: payload.scheduleAt || null,
      appointmentsAffected: targetsFromScope.appointmentsAffected,
      clientsAffected: targetsFromScope.clientsAffected,
      cancellations: cancellableAppointments,
      withoutValidContact: invalidRecipients.length,
      excludedAlreadyNotified: split.excludedTargets.length,
      invalidRecipients: invalidRecipients.slice(0, 30).map((entry) => ({
        recipientKey: entry.target.recipientKey,
        recipientName: entry.target.recipientName,
        reason: entry.reason,
      })),
      excludedRecipients: split.excludedTargets.slice(0, 30).map((entry) => ({
        recipientKey: entry.recipientKey,
        recipientName: entry.recipientName,
      })),
      messagePreview: {
        title: renderedPreview.title,
        subject: renderedPreview.subject,
        body: renderedPreview.body,
      },
      createHoliday: payload.extraOptions?.createHoliday?.enabled ? payload.extraOptions?.createHoliday : null,
    };

    return {
      publicPreview,
      deliverableTargets: split.deliverableTargets,
      excludedTargets: split.excludedTargets,
      cancellableAppointments,
    };
  }

  private async resolveTargets(payload: CommunicationPayloadDto, localId: string) {
    if (payload.scopeType === 'all_clients') {
      const users = await this.prisma.user.findMany({
        where: {
          role: 'client',
          appointments: {
            some: {
              localId,
            },
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
        orderBy: [{ createdAt: 'desc' }],
        take: 10_000,
      });
      const targets: RecipientTarget[] = users.map((user) => ({
        recipientKey: this.buildRecipientKey({
          userId: user.id,
          email: user.email,
          phone: user.phone,
          fallback: `user:${user.id}`,
        }),
        userId: user.id,
        appointmentId: null,
        recipientName: user.name || 'Cliente',
        email: user.email || null,
        phone: user.phone || null,
        appointmentDate: null,
        serviceName: null,
        barberName: null,
      }));

      return {
        targets,
        appointmentsAffected: 0,
        clientsAffected: new Set(targets.map((target) => target.recipientKey)).size,
      };
    }

    const appointments = await this.fetchAppointmentsByScope(payload, localId);
    const mapped = appointments.map((appointment) => this.mapAppointmentToTarget(appointment));
    const targets =
      payload.actionType === 'solo_comunicar'
        ? this.dedupeTargetsByRecipient(mapped)
        : mapped;

    return {
      targets,
      appointmentsAffected: appointments.length,
      clientsAffected: new Set(mapped.map((target) => target.recipientKey)).size,
    };
  }

  private async fetchAppointmentsByScope(payload: CommunicationPayloadDto, localId: string) {
    const where: Prisma.AppointmentWhereInput = {
      localId,
      status: 'scheduled',
    };

    if (payload.scopeType === 'all_day') {
      const date = payload.scopeCriteria.date;
      if (!date) throw new BadRequestException('Debes indicar fecha para "Todas las citas del día".');
      where.startDateTime = {
        gte: startOfDayInTimeZone(date),
        lte: endOfDayInTimeZone(date),
      };
    }

    if (payload.scopeType === 'appointments_morning' || payload.scopeType === 'appointments_afternoon') {
      const date = payload.scopeCriteria.date;
      if (!date) {
        throw new BadRequestException(
          payload.scopeType === 'appointments_morning'
            ? 'Debes indicar fecha para "Citas de la mañana".'
            : 'Debes indicar fecha para "Citas de la tarde".',
        );
      }
      const shiftType: ShiftType =
        payload.scopeType === 'appointments_morning' ? 'morning' : 'afternoon';
      const shiftRange = await this.resolveShiftRangeForDate(localId, date, shiftType);
      if (!shiftRange) {
        return [];
      }
      where.startDateTime = {
        gte: shiftRange.start,
        lt: shiftRange.end,
      };
    }

    if (payload.scopeType === 'day_time_range') {
      const { date, startTime, endTime } = payload.scopeCriteria;
      if (!date || !startTime || !endTime) {
        throw new BadRequestException('Debes indicar fecha y rango horario.');
      }
      const [startHour, startMinute] = startTime.split(':').map((value) => Number(value));
      const [endHour, endMinute] = endTime.split(':').map((value) => Number(value));
      const start = makeDateInTimeZone(date, { hour: startHour, minute: startMinute }, APP_TIMEZONE);
      const end = makeDateInTimeZone(date, { hour: endHour, minute: endMinute }, APP_TIMEZONE);
      if (end.getTime() <= start.getTime()) {
        throw new BadRequestException('El rango horario es inválido.');
      }
      where.startDateTime = { gte: start, lt: end };
    }

    if (payload.scopeType === 'professional_single') {
      const barberId = payload.scopeCriteria.barberId;
      if (!barberId) throw new BadRequestException('Debes seleccionar un profesional.');
      where.barberId = barberId;
      const date = payload.scopeCriteria.date;
      if (date) {
        where.startDateTime = { gte: startOfDayInTimeZone(date), lte: endOfDayInTimeZone(date) };
      }
    }

    if (payload.scopeType === 'professional_multi') {
      const barberIds = (payload.scopeCriteria.barberIds || []).filter(Boolean);
      if (barberIds.length === 0) throw new BadRequestException('Debes seleccionar al menos un profesional.');
      where.barberId = { in: barberIds };
      const date = payload.scopeCriteria.date;
      if (date) {
        where.startDateTime = { gte: startOfDayInTimeZone(date), lte: endOfDayInTimeZone(date) };
      }
    }

    if (payload.scopeType === 'appointment_selection') {
      const appointmentIds = (payload.scopeCriteria.appointmentIds || []).filter(Boolean);
      if (appointmentIds.length === 0) throw new BadRequestException('Debes seleccionar al menos una cita.');
      where.id = { in: appointmentIds };
    }

    return this.prisma.appointment.findMany({
      where,
      orderBy: [{ startDateTime: 'asc' }],
      select: {
        id: true,
        userId: true,
        guestName: true,
        guestContact: true,
        status: true,
        startDateTime: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        barber: {
          select: {
            name: true,
          },
        },
        service: {
          select: {
            name: true,
          },
        },
      },
    });
  }

  private async resolveShiftRangeForDate(localId: string, date: string, shiftType: ShiftType) {
    const dayKey = getWeekdayKey(date, APP_TIMEZONE);
    const fallbackDay = DEFAULT_SHOP_SCHEDULE[dayKey];

    const shopSchedule = await this.prisma.shopSchedule.findUnique({
      where: { localId },
      select: { data: true },
    });
    const daySchedule = this.extractDaySchedule(shopSchedule?.data, dayKey);

    const isClosed =
      typeof daySchedule?.closed === 'boolean'
        ? daySchedule.closed
        : fallbackDay.closed;
    if (isClosed) {
      return null;
    }

    const configuredShift = daySchedule?.[shiftType];
    const fallbackShift = fallbackDay[shiftType];
    const shiftEnabled =
      typeof configuredShift?.enabled === 'boolean'
        ? configuredShift.enabled
        : fallbackShift.enabled;
    if (!shiftEnabled) {
      return null;
    }

    const startClock = configuredShift?.start || fallbackShift.start;
    const endClock = configuredShift?.end || fallbackShift.end;
    const start = this.buildDateFromClock(date, startClock);
    const end = this.buildDateFromClock(date, endClock);
    if (!start || !end || end.getTime() <= start.getTime()) {
      return null;
    }

    return { start, end };
  }

  private extractDaySchedule(data: Prisma.JsonValue | null | undefined, dayKey: DayKey) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return null;
    }
    const day = (data as Record<string, unknown>)[dayKey];
    if (!day || typeof day !== 'object' || Array.isArray(day)) {
      return null;
    }
    return day as {
      closed?: boolean;
      morning?: { enabled?: boolean; start?: string; end?: string };
      afternoon?: { enabled?: boolean; start?: string; end?: string };
    };
  }

  private buildDateFromClock(date: string, rawClock?: string) {
    const clock = (rawClock || '').trim();
    const match = /^(\d{2}):(\d{2})$/.exec(clock);
    if (!match) {
      return null;
    }
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return null;
    }
    return makeDateInTimeZone(date, { hour, minute }, APP_TIMEZONE);
  }

  private mapAppointmentToTarget(appointment: AppointmentScopeRecord): RecipientTarget {
    const guestContact = (appointment.guestContact || '').trim();
    const guestEmail = guestContact.includes('@') ? guestContact : null;
    const guestPhone = guestContact.includes('@') ? null : guestContact || null;
    const email = appointment.user?.email || guestEmail || null;
    const phone = appointment.user?.phone || guestPhone || null;
    const recipientName = appointment.user?.name || appointment.guestName || 'Cliente';
    const recipientKey = this.buildRecipientKey({
      userId: appointment.userId,
      email,
      phone,
      fallback: `appointment:${appointment.id}`,
    });
    return {
      recipientKey,
      userId: appointment.userId,
      appointmentId: appointment.id,
      recipientName,
      email,
      phone,
      appointmentDate: appointment.startDateTime,
      serviceName: appointment.service?.name || null,
      barberName: appointment.barber?.name || null,
    };
  }

  private dedupeTargetsByRecipient(targets: RecipientTarget[]) {
    const seen = new Set<string>();
    const deduped: RecipientTarget[] = [];
    for (const target of targets) {
      if (seen.has(target.recipientKey)) continue;
      seen.add(target.recipientKey);
      deduped.push(target);
    }
    return deduped;
  }

  private async excludeAlreadyNotified(
    localId: string,
    channel: CommunicationChannel,
    targets: RecipientTarget[],
    enabled: boolean,
  ) {
    if (!enabled || targets.length === 0) {
      return { deliverableTargets: targets, excludedTargets: [] as RecipientTarget[] };
    }
    const keys = Array.from(new Set(targets.map((target) => target.recipientKey)));
    const previous = await this.prisma.communicationRecipientResult.findMany({
      where: {
        localId,
        channel,
        status: CommunicationRecipientStatus.sent,
        recipientKey: { in: keys },
      },
      select: {
        recipientKey: true,
      },
      distinct: ['recipientKey'],
    });
    const excludedSet = new Set(previous.map((item) => item.recipientKey));
    const deliverableTargets: RecipientTarget[] = [];
    const excludedTargets: RecipientTarget[] = [];
    for (const target of targets) {
      if (excludedSet.has(target.recipientKey)) {
        excludedTargets.push(target);
      } else {
        deliverableTargets.push(target);
      }
    }
    return { deliverableTargets, excludedTargets };
  }

  private getMissingChannelReason(channel: CommunicationChannel, target: RecipientTarget) {
    if (channel === 'email' && !target.email) return 'missing_email';
    if ((channel === 'sms' || channel === 'whatsapp') && !target.phone) return 'missing_phone';
    return '';
  }

  private renderCampaignMessage(
    campaign: Pick<CommunicationCampaign, 'title' | 'subject' | 'message'>,
    target: Pick<RecipientTarget, 'recipientName' | 'appointmentDate' | 'barberName' | 'serviceName'>,
    localName: string,
  ) {
    const vars = {
      clientName: target.recipientName || 'Cliente',
      date: target.appointmentDate ? this.formatDate(target.appointmentDate) : '',
      time: target.appointmentDate ? this.formatTime(target.appointmentDate) : '',
      professional: target.barberName || '',
      local: localName,
      service: target.serviceName || '',
    };
    return {
      title: this.interpolate(campaign.title || '', vars),
      subject: this.interpolate(campaign.subject || campaign.title || '', vars),
      body: this.interpolate(campaign.message || '', vars),
    };
  }

  private async sendThroughChannel(
    channel: CommunicationChannel,
    target: RecipientTarget,
    rendered: { subject: string; body: string },
  ) {
    if (channel === 'email') {
      await this.notificationsService.sendBroadcastEmail({
        contact: {
          email: target.email,
          name: target.recipientName,
        },
        subject: rendered.subject,
        message: rendered.body,
      });
      return;
    }
    if (channel === 'sms') {
      if (!target.phone) throw new BadRequestException('No hay teléfono para SMS.');
      await this.notificationsService.sendTestSms(target.phone, rendered.body);
      return;
    }
    if (!target.phone) throw new BadRequestException('No hay teléfono para WhatsApp.');
    await this.notificationsService.sendTestWhatsapp(target.phone, {
      message: rendered.body,
      name: target.recipientName,
      date: target.appointmentDate ? this.formatDate(target.appointmentDate) : undefined,
      time: target.appointmentDate ? this.formatTime(target.appointmentDate) : undefined,
    });
  }

  private async tryCreateHolidayFromOptions(
    campaign: CommunicationCampaign,
    createHoliday?: {
      enabled?: boolean;
      type?: 'general' | 'barber';
      start?: string;
      end?: string;
      barberId?: string;
    },
  ) {
    if (!createHoliday?.enabled) return null;
    if (!createHoliday.start || !createHoliday.end) return null;
    try {
      if (createHoliday.type === 'barber' && createHoliday.barberId) {
        const holiday = await this.prisma.barberHoliday.create({
          data: {
            localId: campaign.localId,
            barberId: createHoliday.barberId,
            start: new Date(createHoliday.start),
            end: new Date(createHoliday.end),
          },
        });
        return { barberHolidayId: holiday.id as number };
      }
      const holiday = await this.prisma.generalHoliday.create({
        data: {
          localId: campaign.localId,
          start: new Date(createHoliday.start),
          end: new Date(createHoliday.end),
        },
      });
      return { generalHolidayId: holiday.id as number };
    } catch (error) {
      this.logger.warn(
        `Holiday creation failed campaignId=${campaign.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private async findCampaignOrThrow(campaignId: string) {
    const { localId } = this.getTenantContext();
    const campaign = await this.prisma.communicationCampaign.findFirst({
      where: { id: campaignId, localId },
      include: {
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
    if (!campaign) throw new NotFoundException('Comunicado no encontrado.');
    return campaign;
  }

  private mapCampaign(campaign: any) {
    const scopeCriteria = (campaign.scopeConfig || {}) as Record<string, unknown>;
    const options = (campaign.options || {}) as Record<string, unknown>;
    return {
      id: campaign.id,
      actionType: campaign.actionType,
      scopeType: campaign.scopeType,
      scopeCriteria,
      templateKey: campaign.templateKey,
      channel: campaign.channel,
      status: campaign.status,
      title: campaign.title,
      subject: campaign.subject,
      message: campaign.message,
      internalNote: campaign.internalNote,
      scheduledFor: campaign.scheduledFor,
      executedAt: campaign.executedAt,
      cancelledAt: campaign.cancelledAt,
      impactSummary: campaign.impactSummary,
      resultSummary: campaign.resultSummary,
      options,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
      createdByUser: campaign.createdByUser || null,
      latestExecution: Array.isArray(campaign.executions) ? campaign.executions[0] || null : null,
    };
  }

  private interpolate(text: string, vars: Record<string, string>) {
    return (text || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => vars[key] || '');
  }

  private formatDate(value: Date) {
    return value.toLocaleDateString('es-ES', {
      timeZone: APP_TIMEZONE,
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  private formatTime(value: Date) {
    return value.toLocaleTimeString('es-ES', {
      timeZone: APP_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  private buildRecipientKey(params: {
    userId?: string | null;
    email?: string | null;
    phone?: string | null;
    fallback: string;
  }) {
    const email = params.email?.trim().toLowerCase();
    const phone = params.phone?.trim();
    if (params.userId) return `user:${params.userId}`;
    if (email) return `email:${email}`;
    if (phone) return `phone:${phone}`;
    return params.fallback;
  }

  private validatePayloadRules(payload: CommunicationPayloadDto, allowDraft: boolean) {
    if (payload.actionType === 'comunicar_y_cancelar' && payload.scopeType === 'all_clients') {
      throw new BadRequestException('No se permite cancelar citas con alcance "todos los clientes".');
    }
    if (payload.actionType === 'comunicar_y_cancelar' && payload.scheduleAt) {
      throw new BadRequestException('Los comunicados con cancelación deben ejecutarse de forma inmediata.');
    }
    if (!allowDraft && payload.scheduleAt && payload.actionType === 'comunicar_y_cancelar') {
      throw new BadRequestException('No se puede programar una cancelación masiva.');
    }
  }

  private shouldRunImmediately(dto: CreateCommunicationDto) {
    if (dto.saveAsDraft) return false;
    if (dto.scheduleAt) return false;
    return dto.executeNow !== false;
  }

  private mapExecutionToCampaignStatus(status: CommunicationExecutionStatus): CommunicationStatus {
    if (status === CommunicationExecutionStatus.completed) return CommunicationStatus.completed;
    if (status === CommunicationExecutionStatus.partial) return CommunicationStatus.partial;
    if (status === CommunicationExecutionStatus.cancelled) return CommunicationStatus.cancelled;
    return CommunicationStatus.failed;
  }

  private async ensureFeatureEnabled() {
    const config = await this.tenantConfigService.getEffectiveConfig();
    if (config.features?.communicationsEnabled !== true) {
      throw new ForbiddenException('Comunicados desactivado para este local.');
    }
  }

  private getTenantContext() {
    const context = this.tenantContextPort.getRequestContext();
    return { brandId: context.brandId, localId: context.localId };
  }

  private async resolveLocalName(localId: string) {
    const location = await this.prisma.location.findUnique({
      where: { id: localId },
      select: { name: true },
    });
    return location?.name || 'Local';
  }

  private async logAudit(
    action: string,
    entityId: string,
    actorUserId: string | null | undefined,
    metadata?: Record<string, unknown>,
  ) {
    const { brandId, localId } = this.getTenantContext();
    await this.auditLogsService.log({
      brandId,
      locationId: localId,
      actorUserId: actorUserId || null,
      action,
      entityType: 'communication_campaign',
      entityId,
      metadata,
    });
  }

  private async persistChannelPreference(channel: CommunicationChannel, actorUserId: string | null) {
    const { localId } = this.getTenantContext();
    await this.prisma.communicationChannelPreference.upsert({
      where: { localId },
      create: {
        localId,
        preferredChannel: channel,
        updatedByUserId: actorUserId || null,
      },
      update: {
        preferredChannel: channel,
        updatedByUserId: actorUserId || null,
      },
    });
  }
}
