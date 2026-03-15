#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const KEY_PATTERN = /\bt\(\s*['"]([^'"]+)['"]/g;
const AUTH_KEY_PATTERN = /\btAuth\(\s*['"]([^'"]+)['"]/g;
const TRANSLATE_UI_KEY_PATTERN = /translateUi\(\s*\{[\s\S]*?key\s*:\s*['"]([^'"]+)['"]/g;
const VALID_KEY = /^[A-Za-z0-9_.-]+$/;
const PLACEHOLDER_PATTERN = /\{(\w+)\}/g;

const toSorted = (values) => [...values].sort((a, b) => a.localeCompare(b));

const extractPlaceholders = (value) => {
  const placeholders = new Set();
  if (typeof value !== 'string') return placeholders;
  let match;
  while ((match = PLACEHOLDER_PATTERN.exec(value))) {
    placeholders.add(match[1]);
  }
  return placeholders;
};

const localeHasSamePlaceholders = (left, right) => {
  if (left.size !== right.size) return false;
  for (const key of left) {
    if (!right.has(key)) return false;
  }
  return true;
};

const files = execSync("rg --files src -g '!src/i18n/**'", { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(Boolean);

const runtimeKeys = new Set();
for (const file of files) {
  const content = readFileSync(file, 'utf8');
  const patterns = [KEY_PATTERN, AUTH_KEY_PATTERN, TRANSLATE_UI_KEY_PATTERN];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content))) {
      const key = match[1];
      if (VALID_KEY.test(key)) {
        runtimeKeys.add(key);
      }
    }
  }
}

const es = JSON.parse(readFileSync('src/i18n/locales/es.json', 'utf8'));
const en = JSON.parse(readFileSync('src/i18n/locales/en.json', 'utf8'));

const missingInEs = toSorted([...runtimeKeys].filter((key) => !(key in es)));
const missingInEn = toSorted([...runtimeKeys].filter((key) => !(key in en)));

const placeholderMismatches = [];
for (const key of runtimeKeys) {
  if (!(key in es) || !(key in en)) continue;
  const esPlaceholders = extractPlaceholders(es[key]);
  const enPlaceholders = extractPlaceholders(en[key]);
  if (!localeHasSamePlaceholders(esPlaceholders, enPlaceholders)) {
    placeholderMismatches.push({
      key,
      es: toSorted(esPlaceholders),
      en: toSorted(enPlaceholders),
    });
  }
}

if (missingInEs.length > 0 || missingInEn.length > 0 || placeholderMismatches.length > 0) {
  console.error('I18N_CHECK_FAILED');
  if (missingInEs.length > 0) {
    console.error(`Missing keys in es.json (${missingInEs.length}):`);
    console.error(missingInEs.join('\n'));
  }
  if (missingInEn.length > 0) {
    console.error(`Missing keys in en.json (${missingInEn.length}):`);
    console.error(missingInEn.join('\n'));
  }
  if (placeholderMismatches.length > 0) {
    console.error(`Placeholder mismatches (${placeholderMismatches.length}):`);
    for (const mismatch of placeholderMismatches) {
      console.error(
        `${mismatch.key} | es=[${mismatch.es.join(', ')}] en=[${mismatch.en.join(', ')}]`,
      );
    }
  }
  process.exit(1);
}

console.log(`I18N_CHECK_OK keys=${runtimeKeys.size}`);
