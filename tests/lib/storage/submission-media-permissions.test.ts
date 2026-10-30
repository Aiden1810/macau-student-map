import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

const alice = '22222222-2222-4222-8222-222222222222';
const bob = '33333333-3333-4333-8333-333333333333';
const admin = '44444444-4444-4444-8444-444444444444';
const draft = '10000000-0000-4000-8000-000000000001';
const otherDraft = '10000000-0000-4000-8000-000000000002';
const pending = '10000000-0000-4000-8000-000000000003';
const bobsPending = '10000000-0000-4000-8000-000000000004';
const place = '10000000-0000-4000-8000-000000000005';
const draftMedia = '70000000-0000-4000-8000-000000000001';
const pendingMedia = '70000000-0000-4000-8000-000000000002';
const draftPath = `${alice}/${draft}/${draftMedia}.jpg`;
const pendingPath = `${alice}/${pending}/${pendingMedia}.jpg`;
const db = new PGlite();

async function identity(user: string | null, role = 'authenticated') {
  await db.exec(`reset role; set role ${role}; select set_config('request.jwt.claim.sub','${user ?? ''}',false);`);
}

beforeAll(async () => {
  // Use the real submission/media tables and policies; only Supabase's auth and
  // storage service tables are reduced to the columns used by those policies.
  const source = readFileSync('supabase/migrations/20260830103144_canonical_local_life_model.sql', 'utf8');
  const section = (start: string, end: string) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
  await db.exec(`create role anon; create role authenticated;
    create schema auth; create schema private; create schema storage;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table public.profiles(id uuid primary key, role text);
    create function private.current_user_is_admin() returns boolean language sql security definer set search_path='' as $$
      select exists(select 1 from public.profiles where id=auth.uid() and role='admin') $$;
    create table public.places(id uuid primary key, status text);
    create table public.place_categories(slug text primary key);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner_id text, metadata jsonb);
    create function storage.foldername(name text) returns text[] language sql immutable as $$
      select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
    insert into auth.users values('${alice}'),('${bob}'),('${admin}');
    insert into public.profiles values('${alice}','user'),('${bob}','user'),('${admin}','admin');
    insert into public.place_categories values('food');
    insert into public.places values('${place}','published');
    grant usage on schema public,auth,private,storage to anon,authenticated;`);
  await db.exec(section('create table if not exists public.place_submissions (', 'create table if not exists public.reviews ('));
  await db.exec(`alter table public.place_submissions enable row level security;
    alter table public.place_media enable row level security;
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on public.place_submissions,public.place_media,storage.objects to authenticated;
    grant select on public.places to authenticated;`);
  await db.exec(section('drop policy if exists canonical_submissions_owner_select', 'drop policy if exists canonical_reviews_public_read'));
  await db.exec(section('drop policy if exists canonical_submission_storage_select', 'drop policy if exists canonical_place_storage_admin_insert'));
  // The existing moderation workflow uses this independent administrator policy.
  await db.exec(`create policy canonical_submission_storage_admin_cleanup on storage.objects for delete to authenticated
    using(bucket_id='submission-media' and private.current_user_is_admin());`);
  await db.exec(readFileSync('supabase/migrations/20261029162434_harden_submission_media_permissions.sql', 'utf8'));
}, 30000);

beforeEach(async () => {
  await identity(null, 'postgres');
  await db.exec(`truncate public.place_media,public.place_submissions,storage.objects;
    insert into public.place_submissions(id,name,category_slug,submitted_by,status,submitted_at) values
      ('${draft}','草稿','food','${alice}','draft',null),
      ('${otherDraft}','另一草稿','food','${alice}','draft',null),
      ('${pending}','已提交','food','${alice}','pending',now()),
      ('${bobsPending}','他人投稿','food','${bob}','pending',now());
    insert into public.place_media(id,submission_id,uploaded_by,bucket_id,storage_path,mime_type,byte_size) values
      ('${draftMedia}','${draft}','${alice}','submission-media','${draftPath}','image/jpeg',100),
      ('${pendingMedia}','${pending}','${alice}','submission-media','${pendingPath}','image/jpeg',100);
    insert into storage.objects(bucket_id,name,owner_id) values
      ('submission-media','${draftPath}','${alice}'),('submission-media','${pendingPath}','${alice}');`);
  await identity(alice);
});

afterAll(async () => {await db.close();});

describe.sequential('submission image permissions in PostgreSQL', () => {
  it('allows editing and cleaning up an owned draft image', async () => {
    expect((await db.query("update public.place_media set alt_text='门面',sort_order=2,lifecycle_status='cleanup_pending' where id=$1 returning id", [draftMedia])).rows).toHaveLength(1);
    expect((await db.query("delete from storage.objects where name=$1 returning id", [draftPath])).rows).toHaveLength(1);
    expect((await db.query('delete from public.place_media where id=$1 returning id', [draftMedia])).rows).toHaveLength(1);
  });

  it.each([['another owned draft', otherDraft], ['another account pending submission', bobsPending]])('rejects moving image metadata to %s', async (_label, target) => {
    await expect(db.query('update public.place_media set submission_id=$1 where id=$2', [target, draftMedia])).rejects.toMatchObject({code: '42501'});
  });

  it.each([
    ['bucket_id', 'place-media'],
    ['storage_path', `${bob}/${bobsPending}/70000000-0000-4000-8000-000000000099.jpg`],
    ['uploaded_by', bob],
    ['mime_type', 'image/png'],
    ['byte_size', 200]
  ])('rejects changing immutable image field %s', async (column, value) => {
    await expect(db.query(`update public.place_media set ${column}=$1 where id=$2`, [value, draftMedia])).rejects.toMatchObject({code: '42501'});
  });

  it('freezes submitted image metadata and deletion for its owner', async () => {
    expect((await db.query("update public.place_media set alt_text='审核后修改' where id=$1 returning id", [pendingMedia])).rows).toEqual([]);
    expect((await db.query('delete from public.place_media where id=$1 returning id', [pendingMedia])).rows).toEqual([]);
  });

  it('freezes submitted storage contents and deletion for its owner', async () => {
    expect((await db.query("update storage.objects set metadata='{}' where name=$1 returning id", [pendingPath])).rows).toEqual([]);
    expect((await db.query('delete from storage.objects where name=$1 returning id', [pendingPath])).rows).toEqual([]);
  });

  it.each([
    ['another owner path', `${bob}/${draft}/${draftMedia}.jpg`, 'submission-media'],
    ['another submission path', `${alice}/${pending}/${draftMedia}.jpg`, 'submission-media'],
    ['public bucket', draftPath, 'place-media']
  ])('rejects forged media insert with %s', async (_label, path, bucket) => {
    await expect(db.query(`insert into public.place_media(submission_id,uploaded_by,bucket_id,storage_path,mime_type,byte_size)
      values($1,$2,$3,$4,'image/jpeg',100)`, [draft, alice, bucket, path])).rejects.toMatchObject({code: '42501'});
  });

  it('allows normal storage and metadata insertion for an owned draft', async () => {
    const path = `${alice}/${draft}/70000000-0000-4000-8000-000000000003.webp`;
    await db.query("insert into storage.objects(bucket_id,name,owner_id) values('submission-media',$1,$2)", [path, alice]);
    await db.query(`insert into public.place_media(submission_id,uploaded_by,bucket_id,storage_path,mime_type,byte_size)
      values($1,$2,'submission-media',$3,'image/webp',100)`, [draft, alice, path]);
  });

  it('rejects adding a storage object to a submitted or nonexistent draft', async () => {
    for (const submission of [pending, place]) {
      await expect(db.query("insert into storage.objects(bucket_id,name,owner_id) values('submission-media',$1,$2)",
        [`${alice}/${submission}/70000000-0000-4000-8000-000000000003.jpg`, alice])).rejects.toMatchObject({code: '42501'});
    }
  });

  it('preserves administrator transfer and cleanup of submitted images', async () => {
    await identity(admin);
    expect((await db.query("update public.place_media set lifecycle_status='cleanup_pending' where id=$1 returning id", [pendingMedia])).rows).toHaveLength(1);
    expect((await db.query('delete from storage.objects where name=$1 returning id', [pendingPath])).rows).toHaveLength(1);
    expect((await db.query('delete from public.place_media where id=$1 returning id', [pendingMedia])).rows).toHaveLength(1);
    await db.query(`insert into public.place_media(place_id,uploaded_by,bucket_id,storage_path,mime_type,byte_size,lifecycle_status)
      values($1,$2,'place-media',$3,'image/jpeg',100,'ready')`, [place, alice, `${place}/${pendingMedia}.jpg`]);
  });
});
