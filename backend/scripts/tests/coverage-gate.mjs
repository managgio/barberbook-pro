import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..', '..');
const thresholdsPath = path.join(backendRoot, 'test', 'coverage-thresholds.json');

const readThresholds = () => {
  const raw = fs.readFileSync(thresholdsPath, 'utf8');
  const parsed = JSON.parse(raw);
  return {
    line: Number(parsed.line),
    branch: Number(parsed.branch),
    functions: Number(parsed.functions),
  };
};

const runCoverage = () =>
  new Promise((resolve, reject) => {
    const args = [
      '--test',
      '--experimental-test-coverage',
      '--test-coverage-include=src/**/*.ts',
      '-r',
      'ts-node/register',
      '-r',
      'tsconfig-paths/register',
      'test/**/*.test.ts',
    ];

    const child = spawn(process.execPath, args, {
      cwd: backendRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    child.stdout.on('data', (chunk) => {
      const text = String(chunk);
      output += text;
      process.stdout.write(text);
    });
    child.stderr.on('data', (chunk) => {
      const text = String(chunk);
      output += text;
      process.stderr.write(text);
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Coverage run failed with exit code ${code}.`));
        return;
      }
      resolve(output);
    });
  });

const parseCoverageSummary = (output) => {
  const normalized = output.replace(/\u2139/g, '');
  const match = normalized.match(/all files\s+\|\s*([0-9.]+)\s*\|\s*([0-9.]+)\s*\|\s*([0-9.]+)/i);
  if (!match) {
    throw new Error('Unable to parse coverage summary from node:test output.');
  }
  return {
    line: Number(match[1]),
    branch: Number(match[2]),
    functions: Number(match[3]),
  };
};

const main = async () => {
  const thresholds = readThresholds();
  console.log(
    `Coverage gate thresholds: line>=${thresholds.line}, branch>=${thresholds.branch}, functions>=${thresholds.functions}`,
  );
  const output = await runCoverage();
  const coverage = parseCoverageSummary(output);
  console.log(
    `Coverage summary: line=${coverage.line.toFixed(2)}, branch=${coverage.branch.toFixed(2)}, functions=${coverage.functions.toFixed(2)}`,
  );

  const failures = [];
  if (coverage.line < thresholds.line) failures.push(`line ${coverage.line.toFixed(2)} < ${thresholds.line}`);
  if (coverage.branch < thresholds.branch) failures.push(`branch ${coverage.branch.toFixed(2)} < ${thresholds.branch}`);
  if (coverage.functions < thresholds.functions) {
    failures.push(`functions ${coverage.functions.toFixed(2)} < ${thresholds.functions}`);
  }

  if (failures.length > 0) {
    throw new Error(`Coverage gate failed: ${failures.join('; ')}`);
  }

  console.log('Coverage gate passed.');
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
