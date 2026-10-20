import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';

export const fixturePlace = '11111111-1111-4111-8111-111111111111';
export const fixtureUser = index => `22222222-2222-4222-8222-${String(index + 1).padStart(12, '0')}`;

export async function createCapacityFixture(root, port, nonce) {
  const db = new PGlite();
  let monitor;
  let server;
  try {
  const source = await readFile(`${root}/supabase/migrations/20260830103144_canonical_local_life_model.sql`, 'utf8');
  function section(start, end) {
    const a = source.indexOf(start), b = source.indexOf(end, a);
    if (a < 0 || b < 0) throw new Error(`Migration fixture section not found: ${start}`);
    return source.slice(a, b);
  }
  function table(name) {
    const start = source.indexOf(`create table if not exists public.${name} (`);
    const end = source.indexOf('\n);', start);
    if (start < 0 || end < 0) throw new Error(`Fixture table not found: ${name}`);
    return source.slice(start, end + 3);
  }
  await db.exec(`create role anon; create role authenticated; create schema auth; create schema private;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table public.profiles(id uuid primary key, role text);
    create function private.current_user_is_admin() returns boolean language sql security definer set search_path='' as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin') $$;
    grant usage on schema public,auth,private to anon,authenticated;
    grant execute on function auth.uid(),private.current_user_is_admin() to anon,authenticated;
    ${table('place_categories')} ${table('tags')} ${table('places')} ${table('place_tags')}
    ${table('place_submissions')} ${table('place_media')} ${table('reviews')} ${table('review_media')} ${table('search_events')}
    alter table public.places add column search_keywords_manual text[] not null default '{}';
    create table public.admin_audit_logs(id uuid default gen_random_uuid(),actor_id uuid,action text,entity_type text,entity_id text,metadata jsonb,created_at timestamptz default now());
    ${section('create or replace function public.set_updated_at()', 'drop trigger if exists profiles_set_updated_at')}
    ${section('create or replace function public.calculate_confidence_score(', 'create or replace function public.refresh_place_search_keywords()')}
    create trigger reviews_set_updated_at before update on public.reviews for each row execute function public.set_updated_at();
    alter table public.reviews enable row level security;
    alter table public.places enable row level security;
    create policy capacity_public_places on public.places for select to anon,authenticated using(status='published');
    grant select on public.places to anon,authenticated;
    grant select on public.reviews to anon,authenticated;
    grant insert,update,delete on public.reviews to authenticated;
    ${section('drop policy if exists canonical_reviews_public_read', 'drop policy if exists canonical_review_media_public_read')}
    insert into public.place_categories(slug,label_zh_mo,label_en) values ('food','美食','Food');
    insert into public.tags(id,slug,kind,label_zh_mo,label_en) values ('33333333-3333-4333-8333-333333333333','cafe','category','咖啡','Cafe');
    insert into auth.users select ('22222222-2222-4222-8222-' || lpad(i::text,12,'0'))::uuid from generate_series(1,1000) i;
    insert into public.profiles select id,'member' from auth.users;
    create index capacity_places_status on public.places(status);
    create index capacity_places_confidence on public.places(confidence_score desc);
    create index capacity_reviews_place on public.reviews(place_id,status,created_at desc);`);
  await db.exec(await readFile(`${root}/supabase/migrations/20261019110033_review_post_moderation.sql`, 'utf8'));

  let placeCount = 0;
  let sqlCount = 0;
  let sqlMs = 0;
  let peakRssBytes = process.memoryUsage().rss;
  monitor = setInterval(() => {peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);}, 500);
  const stats = () => ({sqlCount, sqlMs: Number(sqlMs.toFixed(2)), peakRssBytes, placeCount});
  async function query(sql, args = []) {
    const start = performance.now();
    try {return await db.query(sql, args);}
    finally {sqlCount++; sqlMs += performance.now() - start;}
  }
  async function seed(count) {
    await db.exec('delete from public.reviews; delete from private.review_write_limits; delete from public.search_events; delete from public.place_tags; delete from public.places;');
    const ids = [fixturePlace, ...Array.from({length: count - 1}, () => randomUUID())];
    await db.query(`insert into public.places(id,name,name_en,address,category_slug,region,longitude,latitude,price_per_person,status,published_at,confidence_score,search_keywords_manual)
      select id::uuid,'隔离测试咖啡店 '||n,'Fixture Cafe '||n,'澳门氹仔测试地址 '||n,'food','taipa',113.55,22.15,35,'published',now(),0.5,array['咖啡','学生价']
      from unnest($1::text[]) with ordinality as items(id,n)`, [ids]);
    await db.exec("insert into public.place_tags(place_id,tag_id) select id,'33333333-3333-4333-8333-333333333333'::uuid from public.places;");
    placeCount = count;
  }
  const projection = `to_jsonb(p) || jsonb_build_object('place_tags',coalesce((select jsonb_agg(jsonb_build_object('tags',to_jsonb(t))) from public.place_tags pt join public.tags t on t.id=pt.tag_id where pt.place_id=p.id),'[]'::jsonb),'place_media','[]'::jsonb) as row`;
  server = createServer(async (request, response) => {
    response.setHeader('content-type', 'application/json');
    try {
      const url = new URL(request.url, `http://127.0.0.1:${port}`);
      if (url.pathname === '/__capacity/health') {response.end(JSON.stringify({isolated: true, nonce, stats: stats()})); return;}
      const token = request.headers.authorization?.replace('Bearer ', '') ?? '';
      const match = /^capacity-user-(\d+)$/.exec(token);
      if (url.pathname === '/auth/v1/user') {
        if (!match || Number(match[1]) >= 1000) {response.statusCode = 401; response.end('{}'); return;}
        response.end(JSON.stringify({id: fixtureUser(Number(match[1])), aud: 'authenticated', role: 'authenticated', email: 'fixture@example.invalid', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString()})); return;
      }
      if (url.pathname === '/rest/v1/places' && request.method === 'GET') {
        const args = [], conditions = ["p.status='published'"];
        const id = url.searchParams.get('id');
        if (id?.startsWith('eq.')) {args.push(id.slice(3)); conditions.push(`p.id=$${args.length}::uuid`);}
        const limit = Math.min(500, Number(url.searchParams.get('limit') ?? '500'));
        const rows = (await query(`select ${projection} from public.places p where ${conditions.join(' and ')} order by p.confidence_score desc nulls last,p.id limit ${Number.isInteger(limit) && limit > 0 ? limit : 500}`, args)).rows.map(row => row.row);
        response.end(JSON.stringify(request.headers.accept?.includes('application/vnd.pgrst.object+json') ? rows[0] ?? null : rows)); return;
      }
      if (url.pathname === '/rest/v1/search_events' && request.method === 'POST') {
        const buffers=[]; for await(const chunk of request) buffers.push(chunk);
        const event = JSON.parse(Buffer.concat(buffers).toString());
        await query('insert into public.search_events(query,normalized_query,filters,result_count,matched_level) values($1,$2,$3,$4,$5)',
          [event.query,event.normalized_query,JSON.stringify(event.filters),event.result_count,event.matched_level]);
        response.statusCode=201; response.end(); return;
      }
      if (url.pathname === '/rest/v1/rpc/save_place_review' && request.method === 'POST' && match) {
        const buffers=[]; for await(const chunk of request) buffers.push(chunk);
        const body=JSON.parse(Buffer.concat(buffers).toString());
        const result=await db.transaction(async tx => {
          await tx.exec('set local role authenticated');
          await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[fixtureUser(Number(match[1]))]);
          const start=performance.now();
          try{return await tx.query('select public.save_place_review($1,$2,$3,$4) as row',[body.p_place_id,body.p_rating,body.p_content,body.p_expected_updated_at]);}
          finally {sqlCount++; sqlMs+=performance.now()-start;}
        });
        response.end(JSON.stringify(result.rows[0].row)); return;
      }
      response.statusCode=404; response.end(JSON.stringify({message:'Unsupported isolated adapter path'}));
    } catch(error) {
      response.statusCode=400; response.end(JSON.stringify({code:error.code??'CAPACITY_FIXTURE',message:'Isolated database operation failed'}));
    }
  });
  await seed(50);
  await new Promise((resolve,reject)=>{server.once('error',reject); server.listen(port,'127.0.0.1',resolve);});
  return {seed, stats, close:async()=>{clearInterval(monitor);await new Promise(resolve=>server.close(resolve));await db.close();}};
  } catch (error) {
    clearInterval(monitor);
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    await db.close();
    throw error;
  }
}
