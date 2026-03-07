import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..', '..');
const DEFAULT_PORT = 3000;
const DEFAULT_DB_RETRIES = 3;
const DEFAULT_DB_RETRY_DELAY_MS = 1000;

const parsePort = (value, fallback = DEFAULT_PORT) => {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 65535) return fallback;
  return parsed;
};

const isPortAvailable = async (port) =>
  new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => resolve(false));
    server.listen(port, '0.0.0.0', () => {
      server.close(() => resolve(true));
    });
  });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const loadDotenv = async () => {
  try {
    const dotenv = await import('dotenv');
    dotenv.config({ path: path.join(backendRoot, '.env') });
  } catch {
    // Optional; ConfigModule / environment may already provide variables.
  }
};

const checkDatabase = async () => {
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
  } finally {
    await prisma.$disconnect();
  }
};

const parseNumber = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const main = async () => {
  await loadDotenv();
  const port = parsePort(process.env.PORT);

  console.log(`Preflight: checking runtime port ${port}...`);
  const portAvailable = await isPortAvailable(port);
  if (!portAvailable) {
    console.warn(`Preflight warn: PORT ${port} is already in use.`);
  } else {
    console.log(`Preflight: PORT ${port} available.`);
  }

  console.log('Preflight: checking Prisma connectivity...');
  const maxAttempts = parseNumber(process.env.MIGRATION_PREFLIGHT_DB_RETRIES, DEFAULT_DB_RETRIES);
  const retryDelayMs = parseNumber(
    process.env.MIGRATION_PREFLIGHT_DB_RETRY_DELAY_MS,
    DEFAULT_DB_RETRY_DELAY_MS,
  );

  let attempt = 0;
  let lastError = null;
  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      await checkDatabase();
      console.log(`Preflight: Prisma connectivity OK (attempt ${attempt}/${maxAttempts}).`);
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const isLastAttempt = attempt >= maxAttempts;
      if (isLastAttempt) break;
      console.warn(
        `Preflight warn: Prisma connectivity attempt ${attempt}/${maxAttempts} failed (${message}). Retrying in ${retryDelayMs}ms...`,
      );
      // eslint-disable-next-line no-await-in-loop
      await wait(retryDelayMs);
    }
  }

  if (lastError) {
    const message = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(`Preflight failed: Prisma connectivity error (${message}).`);
  }

  console.log('Runtime preflight passed.');
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
