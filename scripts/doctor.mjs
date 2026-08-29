#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const checks = [];

function addCheck(name, ok, detail, fix) {
  checks.push({ name, ok, detail, fix });
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function parseEnvFile(content) {
  const map = new Map();
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    map.set(key, value);
  }
  return map;
}

function run() {
  const envPath = path.join(root, '.env.local');
  const packagePath = path.join(root, 'package.json');
  const mapComponentPath = path.join(root, 'components', 'MapPlaceholder.tsx');
  const nextConfigPath = path.join(root, 'next.config.ts');

  // 1) package.json
  const packageRaw = readText(packagePath);
  if (!packageRaw) {
    addCheck('package.json', false, '找不到 package.json。', '请确认你在项目根目录运行：npm run doctor');
  } else {
    addCheck('package.json', true, '已找到 package.json。');
    try {
      const pkg = JSON.parse(packageRaw);
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      const requiredDeps = ['next', 'react', 'react-dom', '@supabase/supabase-js'];
      const missing = requiredDeps.filter((d) => !deps[d]);
      addCheck(
        '关键依赖',
        missing.length === 0,
        missing.length === 0 ? '关键依赖完整。' : `缺失依赖：${missing.join(', ')}`,
        missing.length === 0 ? undefined : `运行：npm i ${missing.join(' ')}`,
      );
    } catch {
      addCheck('package.json JSON', false, 'package.json 不是合法 JSON。', '修复 package.json 语法错误后重试。');
    }
  }

  // 2) env
  const envRaw = readText(envPath);
  if (!envRaw) {
    addCheck('.env.local', false, '找不到 .env.local。', '在根目录新建 .env.local 并写入 NEXT_PUBLIC_* 变量。');
  } else {
    const env = parseEnvFile(envRaw);
    const requiredKeys = [
      'NEXT_PUBLIC_AMAP_WEB_KEY',
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    ];

    for (const key of requiredKeys) {
      const value = env.get(key);
      addCheck(
        `ENV: ${key}`,
        Boolean(value),
        value ? '已配置。' : '缺失或为空。',
        value ? undefined : `在 .env.local 添加：${key}=你的值`,
      );
    }

    const supabaseUrl = env.get('NEXT_PUBLIC_SUPABASE_URL');
    if (supabaseUrl) {
      const ok = /^https:\/\/.+\.supabase\.co$/i.test(supabaseUrl);
      addCheck(
        'Supabase URL 格式',
        ok,
        ok ? '格式看起来正确。' : '格式可能不正确（应类似 https://xxxx.supabase.co）。',
      );
    }

    const amapSecurityCode = env.get('NEXT_PUBLIC_AMAP_SECURITY_CODE');
    addCheck(
      'ENV: NEXT_PUBLIC_AMAP_SECURITY_CODE',
      true,
      amapSecurityCode ? '已配置。' : '未配置；仅当高德控制台要求安全密钥时才需要。',
    );
  }

  // 3) critical files
  addCheck('components/MapPlaceholder.tsx', exists(mapComponentPath), exists(mapComponentPath) ? '文件存在。' : '文件缺失。');
  addCheck('next.config.ts', exists(nextConfigPath), exists(nextConfigPath) ? '文件存在。' : '文件缺失。');

  // 4) AMap implementation check
  const mapComponentRaw = readText(mapComponentPath);
  if (mapComponentRaw) {
    const usesAmap = /webapi\.amap\.com\/maps/.test(mapComponentRaw) && /loadAmapScript/.test(mapComponentRaw);

    addCheck(
      '高德地图实现',
      usesAmap,
      usesAmap ? '检测到高德地图 SDK 加载逻辑。' : '未检测到高德地图 SDK 加载逻辑。',
      usesAmap ? undefined : '检查 components/MapPlaceholder.tsx 的 loadAmapScript 实现。',
    );
  }

  // 5) stale Mapbox config check
  const nextConfigRaw = readText(nextConfigPath);
  if (nextConfigRaw) {
    const hasLegacyMapbox = /react-map-gl|mapbox-gl/.test(nextConfigRaw);
    addCheck(
      'next.config.ts 旧地图配置',
      !hasLegacyMapbox,
      hasLegacyMapbox ? '仍检测到已移除的 Mapbox 配置。' : '未检测到旧 Mapbox 配置。',
      hasLegacyMapbox ? '移除 react-map-gl 和 mapbox-gl 的残留配置。' : undefined,
    );
  }

  const passCount = checks.filter((c) => c.ok).length;
  const failCount = checks.length - passCount;

  console.log('\nMU Map Doctor 检查报告\n');

  for (const c of checks) {
    const mark = c.ok ? '✅' : '❌';
    console.log(`${mark} ${c.name}: ${c.detail}`);
    if (!c.ok && c.fix) {
      console.log(`   修复建议: ${c.fix}`);
    }
  }

  console.log(`\n总计: ${checks.length} 项 | 通过: ${passCount} | 失败: ${failCount}\n`);

  if (failCount > 0) {
    process.exitCode = 1;
  }
}

run();
