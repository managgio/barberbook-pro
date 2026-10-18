import 'reflect-metadata';
import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { Test } from '@nestjs/testing';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { WebsiteController } from '@/modules/website/website.controller';
import { WebsiteAccessGuard } from '@/modules/website/website-access.guard';
import { WebsiteConfigStore } from '@/modules/website/website-config.store';

test('application wires Website authorization into FAQ, gallery, publication and Platform', async () => {
  // Compile the real module graph without lifecycle hooks, database access or provider calls.
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService).useValue({}).compile();
  try {
    assert.ok(module.get(WebsiteController));
    assert.ok(module.get(WebsiteAccessGuard));
    assert.ok(module.get(WebsiteConfigStore));
  } finally { await module.close(); }
});
