#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const messageDir = path.join(process.cwd(), 'messages');
const locales = ['zh-CN', 'zh-MO', 'en'];

function flatten(value, prefix = '') {
  const keys = [];
  for (const [key, child] of Object.entries(value)) {
    const next = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) keys.push(...flatten(child, next));
    else keys.push(next);
  }
  return keys;
}

const dictionaries = new Map(
  locales.map((locale) => {
    const file = path.join(messageDir, `${locale}.json`);
    return [locale, JSON.parse(fs.readFileSync(file, 'utf8'))];
  })
);
const reference = new Set(flatten(dictionaries.get('zh-CN')));
let failed = false;

for (const locale of locales.slice(1)) {
  const keys = new Set(flatten(dictionaries.get(locale)));
  const missing = [...reference].filter((key) => !keys.has(key));
  const extra = [...keys].filter((key) => !reference.has(key));
  if (missing.length || extra.length) {
    failed = true;
    console.error(`${locale}: missing=${missing.join(', ') || '-'} extra=${extra.join(', ') || '-'}`);
  }
}

if (failed) process.exitCode = 1;
else console.log(`i18n contract OK: ${reference.size} keys across ${locales.join(', ')}`);
