#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const messageDir = path.join(root, 'messages');
const locales = ['zh-CN', 'zh-MO', 'en'];

const localeFiles = Object.fromEntries(locales.map((locale) => [locale, path.join(messageDir, `${locale}.json`)]));

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function flatten(obj, prefix = '') {
  const result = new Map();

  for (const [key, value] of Object.entries(obj)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [childKey, childValue] of flatten(value, nextKey)) {
        result.set(childKey, childValue);
      }
      continue;
    }

    result.set(nextKey, value);
  }

  return result;
}

function isEmptyValue(value) {
  return typeof value !== 'string' || value.trim().length === 0;
}

function containsCjk(text) {
  return /[\u3400-\u9FFF]/.test(text);
}

// 简体特征字符（避免误伤，按当前产品高频词优先）
const simplifiedOnlyChars = /[饮点场区筛卖达营业评条后台图]/;

function main() {
  const errors = [];

  for (const [locale, filePath] of Object.entries(localeFiles)) {
    if (!fs.existsSync(filePath)) {
      errors.push(`[missing-file] ${locale} -> ${filePath}`);
    }
  }

  if (errors.length > 0) {
    console.error(errors.join('\n'));
    process.exit(1);
  }

  const parsed = Object.fromEntries(locales.map((locale) => [locale, readJson(localeFiles[locale])]));
  const flattened = Object.fromEntries(locales.map((locale) => [locale, flatten(parsed[locale])]));

  const keySets = Object.fromEntries(locales.map((locale) => [locale, new Set(flattened[locale].keys())]));
  const allKeys = new Set(locales.flatMap((locale) => Array.from(keySets[locale])));

  for (const key of allKeys) {
    for (const locale of locales) {
      if (!keySets[locale].has(key)) {
        errors.push(`[missing-key] ${locale} missing: ${key}`);
      }
    }
  }

  for (const locale of locales) {
    for (const [key, value] of flattened[locale]) {
      if (isEmptyValue(value)) {
        errors.push(`[empty-value] ${locale}.${key}`);
      }
    }
  }

  for (const [key, value] of flattened.en) {
    if (typeof value === 'string' && containsCjk(value)) {
      errors.push(`[en-has-cjk] en.${key} -> ${value}`);
    }
  }

  for (const [key, value] of flattened['zh-MO']) {
    if (typeof value === 'string' && simplifiedOnlyChars.test(value)) {
      errors.push(`[zh-mo-simplified] zh-MO.${key} -> ${value}`);
    }
  }

  if (errors.length > 0) {
    console.error('i18n check failed:\n');
    console.error(errors.join('\n'));
    process.exit(1);
  }

  console.log(`i18n check passed: ${allKeys.size} keys across ${locales.join(', ')}`);
}

main();
