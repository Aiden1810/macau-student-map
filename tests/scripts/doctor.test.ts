import {spawnSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {afterEach, describe, expect, it} from 'vitest';

const root = process.cwd();
const doctor = path.join(root, 'scripts/doctor.mjs');
const directories: string[] = [];
const valid = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://fixture-project.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon-value-not-a-real-key',
  NEXT_PUBLIC_AMAP_WEB_KEY: 'fixture-map-value-not-a-real-key',
};

function runDoctor(env: Record<string, string> | string | null = valid) {
  const directory = mkdtempSync(path.join(tmpdir(), 'chengmi-doctor-'));
  directories.push(directory);
  function write(file: string, content: string) {
    const target = path.join(directory, file);
    mkdirSync(path.dirname(target), {recursive: true});
    writeFileSync(target, content);
  }
  write('package.json', readFileSync(path.join(root, 'package.json'), 'utf8'));
  write('components/MapPlaceholder.tsx', '// loadAmapScript webapi.amap.com/maps');
  write('next.config.ts', 'export default {};');
  write('supabase/migrations/20260830103144_canonical_local_life_model.sql', '');
  write('supabase/config.toml', readFileSync(path.join(root, 'supabase/config.toml'), 'utf8'));
  if (env !== null) {
    write('.env.local', typeof env === 'string' ? env : Object.entries(env).map(([key, value]) => `${key}=${value}`).join('\n'));
  }
  const result = spawnSync(process.execPath, [doctor], {cwd: directory, encoding: 'utf8', timeout: 10000});
  expect(result.error).toBeUndefined();
  return {status: result.status, output: result.stdout + result.stderr};
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, {recursive: true, force: true});
});

describe('doctor configuration diagnostics', () => {
  it('reports a missing local environment file', () => {
    const result = runDoctor(null);
    expect(result.status).toBe(1);
    expect(result.output).toContain('找不到 .env.local');
  });

  for (const key of Object.keys(valid)) {
    it.each([undefined, '', '   ', '"  "', "'  '"])(`rejects missing or empty ${key}: %s`, value => {
      const env: Record<string, string> = {...valid};
      if (value === undefined) delete env[key];
      else env[key] = value;
      const result = runDoctor(env);
      expect(result.status).toBe(1);
      expect(result.output).toContain(`❌ ENV: ${key}: 缺失或为空。`);
    });
  }

  it('rejects the repository example instead of reporting it configured', () => {
    const result = runDoctor(readFileSync(path.join(root, '.env.example'), 'utf8'));
    expect(result.status).toBe(1);
    for (const key of Object.keys(valid)) {
      expect(result.output).toContain(`❌ ENV: ${key}: 仍为示例占位值。`);
    }
  });

  it.each(['YOUR_API_KEY', '"YOUR_API_KEY"', "'your_api_key'"])(
    'rejects quoted and unquoted placeholder keys: %s', value => {
      const result = runDoctor({...valid, NEXT_PUBLIC_AMAP_WEB_KEY: value});
      expect(result.status).toBe(1);
      expect(result.output).toContain('❌ ENV: NEXT_PUBLIC_AMAP_WEB_KEY: 仍为示例占位值。');
    }
  );

  it('accepts populated values without exposing them or claiming service verification', () => {
    const env = {...valid, DEEPSEEK_API_KEY: 'fixture-ai-value-not-a-real-key'};
    const result = runDoctor(env);
    expect(result.status).toBe(0);
    for (const value of Object.values(env)) expect(result.output).not.toContain(value);
    expect(result.output).toContain('未验证服务连通性');
    expect(result.output).toContain('未发起 AI 请求，未验证有效性');
  });

  it.each(['http://127.0.0.1:54321', 'http://localhost:54321/', 'http://[::1]:54321'])(
    'accepts independent local Supabase address %s', url => {
      expect(runDoctor({...valid, NEXT_PUBLIC_SUPABASE_URL: url}).status).toBe(0);
    }
  );

  it.each([
    'not-a-url', 'http://fixture-project.supabase.co', 'https://fixture-project.supabase.co.evil.test',
    'http://127.0.0.1.evil.test:54321', 'ftp://localhost:54321',
    'https://user:fixture-password@fixture-project.supabase.co',
    'https://fixture-project.supabase.co/rest/v1',
    'https://fixture-project.supabase.co?token=fixture-token',
  ])('rejects malformed or unsupported Supabase address %s without printing it', url => {
    const result = runDoctor({...valid, NEXT_PUBLIC_SUPABASE_URL: url});
    expect(result.status).toBe(1);
    expect(result.output).toContain('❌ Supabase URL 格式');
    expect(result.output).not.toContain(url);
  });

  it('keeps an absent optional AI key non-blocking but explains what is unverified', () => {
    const result = runDoctor();
    expect(result.status).toBe(0);
    expect(result.output).toContain('未配置；基础检查可继续，真实 AI 功能无法验证。');
  });

  it.each(['DEEPSEEK_API_KEY', 'NEXT_PUBLIC_AMAP_SECURITY_CODE'])(
    'rejects placeholders when the optional %s is supplied', key => {
      const result = runDoctor({...valid, [key]: 'YOUR_OPTIONAL_KEY'});
      expect(result.status).toBe(1);
      expect(result.output).toContain(`❌ ENV: ${key}: 仍为示例占位值。`);
    }
  );
});
