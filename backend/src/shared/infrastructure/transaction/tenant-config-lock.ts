import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

// All read-modify-write config producers share the same brand lock as Website and Platform.
// Keep provider calls outside this boundary so a webhook cannot overwrite a newer image.
export function withTenantConfigLock<T>(prisma: PrismaService, brandId: string, action: (tx: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM Brand WHERE id = ${brandId} FOR UPDATE`;
    return action(tx);
  }, { timeout: 10_000 });
}
