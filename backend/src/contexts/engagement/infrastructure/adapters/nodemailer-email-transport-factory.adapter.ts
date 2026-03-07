import { Injectable, Optional } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import {
  EngagementEmailTransportConfig,
  EngagementEmailTransportFactoryPort,
  EngagementEmailTransportPort,
} from '../../ports/outbound/email-transport-factory.port';

type NodemailerCreateTransport = (config: EngagementEmailTransportConfig) => {
  sendMail(payload: unknown): Promise<unknown>;
};

@Injectable()
export class NodemailerEmailTransportFactoryAdapter implements EngagementEmailTransportFactoryPort {
  constructor(
    @Optional()
    private readonly createTransportFactory?: NodemailerCreateTransport,
  ) {}

  private buildDefaultFactory(): NodemailerCreateTransport {
    return (config) => nodemailer.createTransport(config);
  }

  createTransport(config: EngagementEmailTransportConfig): EngagementEmailTransportPort {
    const factory = this.createTransportFactory ?? this.buildDefaultFactory();
    return factory(config);
  }
}
