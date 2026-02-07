import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(scriptDir, '..');
const tscBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const nodeBin = process.execPath;

const env = {
  ...process.env,
  DISABLE_CONSOLE_NINJA: '1',
  CONSOLE_NINJA_ENABLED: 'false',
};

const run = (command, args, options = {}) =>
  spawn(command, args, {
    cwd: backendRoot,
    env,
    stdio: 'inherit',
    ...options,
  });

const runSync = (command, args) =>
  spawnSync(command, args, {
    cwd: backendRoot,
    env,
    stdio: 'inherit',
  });

const initialBuild = runSync(tscBin, ['tsc', '-p', 'tsconfig.build.json']);
if (initialBuild.status !== 0) {
  process.exit(initialBuild.status ?? 1);
}

const distEntry = path.join(backendRoot, 'dist', 'main.js');
if (!fs.existsSync(distEntry)) {
  console.error('No se encontró dist/main.js tras compilar. Revisa tsconfig.build.json.');
  process.exit(1);
}

const tscWatch = run(tscBin, ['tsc', '-p', 'tsconfig.build.json', '--watch', '--preserveWatchOutput']);

let appProcess = null;
const spawnApp = () => {
  const child = run(nodeBin, ['--enable-source-maps', 'dist/main.js']);
  child.on('exit', () => {
    if (appProcess === child) {
      appProcess = null;
    }
  });
  return child;
};
const restartApp = () => {
  if (appProcess && appProcess.exitCode === null) {
    appProcess.once('exit', () => {
      if (!shuttingDown) {
        appProcess = spawnApp();
      }
    });
    appProcess.kill('SIGTERM');
    return;
  }
  appProcess = spawnApp();
};
restartApp();

fs.watchFile(distEntry, { interval: 600 }, (current, previous) => {
  if (shuttingDown) return;
  if (!current.mtimeMs) return;
  if (current.mtimeMs === previous.mtimeMs) return;
  restartApp();
});

let shuttingDown = false;
const shutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  fs.unwatchFile(distEntry);
  tscWatch.kill('SIGTERM');
  appProcess?.kill('SIGTERM');
  if (signal) {
    process.exit(0);
  }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

const onChildExit = (code) => {
  if (shuttingDown) return;
  shuttingDown = true;
  fs.unwatchFile(distEntry);
  appProcess?.kill('SIGTERM');
  process.exit(code ?? 0);
};

tscWatch.on('exit', onChildExit);
