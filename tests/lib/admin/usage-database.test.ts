import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';

const db = new PGlite();
const admin = '11111111-1111-4111-8111-111111111111';
const member = '22222222-2222-4222-8222-222222222222';
const token = 'a'.repeat(64);
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create schema auth; create schema private;
    create table auth.users(id uuid primary key,email text,created_at timestamptz,deleted_at timestamptz,is_anonymous boolean default false);
    create table public.profiles(id uuid primary key,role text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function private.current_user_is_admin() returns boolean language sql security definer set search_path='' as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin') $$;
    grant usage on schema public,auth,private to anon,authenticated;
    insert into auth.users(id,email,created_at) values ('${admin}','admin@example.test',now()-interval '90 days'),('${member}','student@example.test',now()-interval '1 hour');
    insert into public.profiles values ('${admin}','admin'),('${member}','member');
    insert into auth.users(id,created_at,is_anonymous,deleted_at) values
      ('33333333-3333-4333-8333-333333333333',now()-interval '2 hours',false,null),
      ('44444444-4444-4444-8444-444444444444',now()-interval '1 hour',true,null),
      ('55555555-5555-4555-8555-555555555555',now()-interval '1 hour',false,now());`);
  await db.exec(
    readFileSync(
      'supabase/migrations/20261022023204_admin_usage_dashboard.sql',
      'utf8',
    ),
  );
}, 20000);
afterAll(async () => {
  await db.close();
});
async function identity(id: string | null, role = 'authenticated') {
  await db.exec(
    `reset role; set role ${role}; select set_config('request.jwt.claim.sub','${id ?? ''}',false);`,
  );
}
async function configure() {
  await db.exec(
    `reset role; update observability_private.config set token_hash=encode(sha256(convert_to('${token}','UTF8')),'hex'),enabled_at=now() where singleton;`,
  );
}
const event = (id = '66666666-6666-4666-8666-666666666666') => ({
  id,
  request_id: '77777777-7777-4777-8777-777777777777',
  occurred_at: new Date().toISOString(),
  kind: 'ai',
  feature: 'assistant.chat',
  model: 'deepseek-flash',
  outcome: 'success',
  duration_ms: 100,
  status: null,
  input_tokens: 100,
  output_tokens: 20,
  cache_read_tokens: 0,
  cost_low: 0.000027,
  cost_high: 0.000054,
  price_version: 'deepseek-2026-10-22',
});
async function ingest(events: unknown[], secret = token) {
  return db.query('select public.record_api_usage($1,$2::jsonb)', [
    secret,
    JSON.stringify(events),
  ]);
}
describe('registration aggregates and protected usage database', () => {
  it('uses Macau calendar boundaries for seven days and rolling hours for one day', async () => {
    await db.exec('reset role');
    for (const [range, expected] of [
      ['7d', '2026-10-15T16:00:00Z'],
      ['24h', '2026-10-21T00:30:00Z'],
      ['30d', '2026-09-22T16:00:00Z'],
    ]) {
      const result = await db.query<{start: string}>(
        'select private.dashboard_range_start($1,$2::timestamptz)::text as start',
        [range, '2026-10-22T00:30:00Z'],
      );
      expect(Date.parse(result.rows[0].start)).toBe(Date.parse(expected));
    }
  });
  it('reports exact registrations without profiles, excluding anonymous/deleted accounts and filling empty buckets', async () => {
    await identity(admin);
    const result = (
      await db.query<{
        data: {
          total: number;
          newUsers: number;
          timeline: Array<{count: number}>;
        };
      }>("select public.admin_registration_stats('24h') as data")
    ).rows[0].data;
    expect(result.total).toBe(3);
    expect(result.newUsers).toBe(2);
    expect(result.timeline).toHaveLength(25);
    expect(result.timeline.reduce((sum, p) => sum + p.count, 0)).toBe(2);
    expect(
      (
        await db.query<{data: {timeline: unknown[]}}>(
          "select public.admin_registration_stats('7d') as data",
        )
      ).rows[0].data.timeline,
    ).toHaveLength(7);
    expect(JSON.stringify(result)).not.toContain('@');
  });
  it('denies ordinary and anonymous readers, including private function calls', async () => {
    for (const [id, role] of [
      [member, 'authenticated'],
      [null, 'authenticated'],
      [null, 'anon'],
    ] as const) {
      await identity(id, role);
      for (const sql of [
        "select public.admin_registration_stats('7d')",
        "select public.admin_usage_report('7d')",
        "select private.admin_usage_report('7d')",
      ]) {
        await expect(db.query(sql)).rejects.toMatchObject({code: '42501'});
      }
    }
  });
  it('rejects invalid report ranges', async () => {
    await identity(admin);
    await expect(
      db.query("select public.admin_registration_stats('all')"),
    ).rejects.toMatchObject({code: '22023'});
    await expect(
      db.query('select public.admin_usage_report(null)'),
    ).rejects.toMatchObject({code: '22023'});
  });
  it('is disabled until a server credential is configured and rejects all invalid secrets', async () => {
    await identity(null, 'anon');
    await expect(ingest([event()])).rejects.toMatchObject({code: '42501'});
    await configure();
    await identity(null, 'anon');
    for (const secret of ['', 'b'.repeat(64)])
      await expect(ingest([event()], secret)).rejects.toMatchObject({
        code: '42501',
      });
    await expect(
      db.query('select * from observability_private.events'),
    ).rejects.toMatchObject({code: '42501'});
    await expect(
      db.query('select * from observability_private.config'),
    ).rejects.toMatchObject({code: '42501'});
  });
  it('accepts only a bounded metadata batch and deduplicates repeated event IDs', async () => {
    await configure();
    await identity(null, 'anon');
    await ingest([event()]);
    await ingest([event()]);
    await identity(admin);
    const result = (
      await db.query<{
        data: {
          summary: Array<{
            kind: string;
            calls: number;
            inputTokens: number;
            unknownUsage: number;
            costLow: number;
          }>;
        };
      }>("select public.admin_usage_report('7d') as data")
    ).rows[0].data;
    expect(result.summary.find((row) => row.kind === 'ai')).toMatchObject({
      calls: 1,
      inputTokens: 100,
      unknownUsage: 0,
      costLow: 0.000027,
    });
    await identity(null, 'anon');
    await expect(ingest(Array(21).fill(event()))).rejects.toMatchObject({
      code: '22023',
    });
    await expect(
      ingest([{...event(), prompt: 'private chat'}]),
    ).rejects.toMatchObject({code: '22023'});
    await expect(
      ingest([{...event(), feature: 'unknown'}]),
    ).rejects.toBeDefined();
  });
  it('keeps failed calls with missing usage distinct from zero and separates HTTP from model calls', async () => {
    await configure();
    await identity(null, 'anon');
    await ingest([
      {
        ...event('88888888-8888-4888-8888-888888888888'),
        outcome: 'timeout',
        input_tokens: null,
        output_tokens: null,
        cache_read_tokens: null,
        cost_low: null,
        cost_high: null,
        price_version: null,
      },
      {
        ...event('99999999-9999-4999-8999-999999999999'),
        kind: 'http',
        model: null,
        status: 429,
        outcome: 'limited',
        input_tokens: null,
        output_tokens: null,
        cache_read_tokens: null,
        cost_low: null,
        cost_high: null,
        price_version: null,
      },
    ]);
    await identity(admin);
    const result = (
      await db.query<{
        data: {
          summary: Array<{
            kind: string;
            calls: number;
            unknownUsage: number;
            timeouts: number;
            limited: number;
            pricedCalls: number;
          }>;
          collection: {enabled: boolean};
        };
      }>("select public.admin_usage_report('24h') as data")
    ).rows[0].data;
    expect(result.collection.enabled).toBe(true);
    expect(result.summary.find((row) => row.kind === 'ai')).toMatchObject({
      calls: 2,
      unknownUsage: 1,
      timeouts: 1,
      pricedCalls: 1,
    });
    expect(result.summary.find((row) => row.kind === 'http')).toMatchObject({
      calls: 1,
      limited: 1,
    });
  });
  it('cleans up expired metadata on ingestion without granting administrators direct table access', async () => {
    await db.exec(`reset role; insert into observability_private.events select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',request_id,now()-interval '60 days',kind,feature,model,outcome,duration_ms,status,input_tokens,output_tokens,cache_read_tokens,cost_low,cost_high,price_version from observability_private.events limit 1;
      update observability_private.config set last_cleanup_at=null where singleton;`);
    await identity(null, 'anon');
    await ingest([event()]);
    await db.exec('reset role');
    expect(
      (
        await db.query(
          "select id from observability_private.events where occurred_at<now()-interval '45 days'",
        )
      ).rows,
    ).toEqual([]);
    await identity(admin);
    await expect(
      db.query('select * from observability_private.events'),
    ).rejects.toMatchObject({code: '42501'});
  });
});
