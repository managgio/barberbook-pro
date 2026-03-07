import net from 'node:net';
import { spawn } from 'node:child_process';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseDatabaseAddress = () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required for ci:prepare:db');
  }
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 3306),
  };
};

const waitForTcp = ({ host, port, timeoutMs }) =>
  new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const attempt = () => {
      const socket = new net.Socket();
      socket.setTimeout(2_000);
      socket.on('connect', () => {
        socket.destroy();
        resolve();
      });
      const onError = () => {
        socket.destroy();
        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error(`Timed out waiting for ${host}:${port}`));
          return;
        }
        setTimeout(attempt, 1_000);
      };
      socket.on('timeout', onError);
      socket.on('error', onError);
      socket.connect(port, host);
    };
    attempt();
  });

const run = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: process.env,
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code}`));
    });
  });

const runWithRetry = async ({ label, retries, delayMs, command, args, onRetry }) => {
  let lastError = null;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      console.log(`[ci:prepare:db] ${label} attempt ${attempt}/${retries}`);
      await run(command, args);
      return;
    } catch (error) {
      lastError = error;
      if (attempt >= retries) break;
      console.warn(`[ci:prepare:db] ${label} failed: ${error instanceof Error ? error.message : String(error)}`);
      if (onRetry) await onRetry(attempt, error);
      await wait(delayMs);
    }
  }
  throw lastError;
};

const main = async () => {
  const db = parseDatabaseAddress();
  console.log(`[ci:prepare:db] waiting for mysql at ${db.host}:${db.port}`);
  await waitForTcp({ ...db, timeoutMs: 90_000 });
  console.log('[ci:prepare:db] mysql is reachable');

  await runWithRetry({
    label: 'prisma:deploy',
    retries: 3,
    delayMs: 5_000,
    command: 'npm',
    args: ['run', 'prisma:deploy'],
    onRetry: async () => {
      try {
        await run('npx', ['prisma', 'migrate', 'status']);
      } catch {
        // best effort diagnostic only
      }
    },
  });

  await runWithRetry({
    label: 'prisma:seed',
    retries: 2,
    delayMs: 3_000,
    command: 'npm',
    args: ['run', 'prisma:seed'],
  });

  console.log('[ci:prepare:db] database prepared successfully');
};

main().catch((error) => {
  console.error(`[ci:prepare:db] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
