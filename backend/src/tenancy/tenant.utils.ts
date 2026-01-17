import { PrismaService } from '../prisma/prisma.service';
import { runWithTenantContextAsync } from './tenant.context';

export const runForEachActiveLocation = async (
  prisma: PrismaService,
  fn: (context: { brandId: string; localId: string }) => Promise<void>,
) => {
  const locations = await prisma.location.findMany({
    where: { isActive: true },
    select: { id: true, brandId: true },
    orderBy: { createdAt: 'asc' },
  });

  for (const location of locations) {
    await runWithTenantContextAsync({ brandId: location.brandId, localId: location.id }, () =>
      fn({ brandId: location.brandId, localId: location.id }),
    );
  }
};
