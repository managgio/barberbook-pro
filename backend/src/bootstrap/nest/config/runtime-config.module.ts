import { ConfigModule } from '@nestjs/config';

// Load .env before business modules capture environment-backed constants.
// ConfigModule preserves values already provided by the deployment environment.
export const runtimeConfigModule = ConfigModule.forRoot({ isGlobal: true });
