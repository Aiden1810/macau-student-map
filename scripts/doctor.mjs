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

function isExampleValue(value) {
  return /^YOUR_[A-Z0-9_]+$/i.test(value) || /YOUR_PROJECT_REF/i.test(value);
}

function isSupabaseUrl(value) {
  try {
    const url = new URL(value);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    const cloud = url.protocol === 'https:' && /^[a-z0-9-]+\.supabase\.co$/i.test(url.hostname);
    return (cloud || (local && ['http:', 'https:'].includes(url.protocol))) &&
      !url.username && !url.password && !url.search && !url.hash && url.pathname === '/';
  } catch {
    return false;
  }
}

function run() {
  const envPath = path.join(root, '.env.local');
  const packagePath = path.join(root, 'package.json');
  const mapComponentPath = path.join(root, 'components', 'MapPlaceholder.tsx');
  const nextConfigPath = path.join(root, 'next.config.ts');
  const migrationPath = path.join(root, 'supabase', 'migrations', '20260830103144_canonical_local_life_model.sql');
  const supabaseConfigPath = path.join(root, 'supabase', 'config.toml');

  const nodeMajor = Number(process.versions.node.split('.')[0]);
  addCheck(
    'Node.js 版本',
    nodeMajor === 24,
    `当前 ${process.versions.node}；要求 24.x，与 CI 和 Vercel 一致。`,
    nodeMajor === 24 ? undefined : '安装 Node.js 24 LTS，与 .nvmrc 和 package.json 保持一致。',
  );

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
      const value = env.get(key)?.trim();
      const placeholder = Boolean(value && isExampleValue(value));
      const configured = Boolean(value) && !placeholder;
      addCheck(
        `ENV: ${key}`,
        configured,
        placeholder ? '仍为示例占位值。' : configured ? '已填写；未验证服务连通性。' : '缺失或为空。',
        configured ? undefined : `在 .env.local 填写 ${key} 的开发环境配置（不要使用示例占位值）。`,
      );
    }

    const supabaseUrl = env.get('NEXT_PUBLIC_SUPABASE_URL')?.trim();
    if (supabaseUrl && !isExampleValue(supabaseUrl)) {
      const ok = isSupabaseUrl(supabaseUrl);
      addCheck(
        'Supabase URL 格式',
        ok,
        ok ? '云端或本地回环地址格式正确；未验证连接。' : '格式不正确：请使用 HTTPS Supabase 项目地址或 HTTP(S) 本地回环地址。',
      );
    }

    const amapSecurityCode = env.get('NEXT_PUBLIC_AMAP_SECURITY_CODE')?.trim();
    const securityPlaceholder = Boolean(amapSecurityCode && isExampleValue(amapSecurityCode));
    addCheck(
      'ENV: NEXT_PUBLIC_AMAP_SECURITY_CODE',
      !securityPlaceholder,
      securityPlaceholder ? '仍为示例占位值。' : amapSecurityCode ? '已填写；未验证服务连通性。' : '未配置；仅当高德控制台要求安全密钥时才需要。',
      securityPlaceholder ? '仅当高德控制台要求安全密钥时填写有效配置，否则留空。' : undefined,
    );

    const deepseekKey = env.get('DEEPSEEK_API_KEY')?.trim();
    const aiPlaceholder = Boolean(deepseekKey && isExampleValue(deepseekKey));
    addCheck(
      'ENV: DEEPSEEK_API_KEY',
      !aiPlaceholder,
      aiPlaceholder ? '仍为示例占位值。' : deepseekKey ? '已填写；未发起 AI 请求，未验证有效性。' : '未配置；基础检查可继续，真实 AI 功能无法验证。',
      aiPlaceholder ? '需要验证 AI 时填写服务端开发配置，否则留空；不要添加 NEXT_PUBLIC_ 前缀。' : undefined,
    );
  }

  // 3) critical files
  addCheck('components/MapPlaceholder.tsx', exists(mapComponentPath), exists(mapComponentPath) ? '文件存在。' : '文件缺失。');
  addCheck('next.config.ts', exists(nextConfigPath), exists(nextConfigPath) ? '文件存在。' : '文件缺失。');
  addCheck('Supabase 规范迁移', exists(migrationPath), exists(migrationPath) ? '迁移文件存在。' : '规范数据模型迁移缺失。');

  const supabaseConfig = readText(supabaseConfigPath) ?? '';
  const hasPrivateBucket = /\[storage\.buckets\."submission-media"\][\s\S]*?public\s*=\s*false/.test(supabaseConfig);
  const hasPublicBucket = /\[storage\.buckets\."place-media"\][\s\S]*?public\s*=\s*true/.test(supabaseConfig);
  addCheck(
    'Storage buckets',
    hasPrivateBucket && hasPublicBucket,
    hasPrivateBucket && hasPublicBucket ? '私有投稿桶和公开地点桶配置完整。' : 'Storage bucket 配置不完整。',
  );

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

  console.log('\nChengmi Doctor 检查报告\n');

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
