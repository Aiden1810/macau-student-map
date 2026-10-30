import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
const state = vi.hoisted(() => ({cache: new Map<string, unknown>()}));
vi.mock('next/cache', () => ({
  unstable_cache: (load: () => Promise<unknown>, keys: string[]) => async () => {
    const key = keys.join('|');
    if (!state.cache.has(key)) state.cache.set(key, await load());
    return state.cache.get(key);
  }, revalidateTag: () => state.cache.clear()
}));
import {GET as oldEndpoint} from '../../../app/api/shops/route';
import {GET as placeEndpoint} from '../../../app/api/places/route';
import {mapShopList} from '../../../lib/mappers/shop';
import {createShopCacheRefreshRoute} from '../../../lib/api/shop-cache-refresh';
const admin = {ok: true as const, user: {id: 'admin'}, role: 'admin' as const, accessToken: 'admin-token'};
let reads: number; let name: string;
beforeEach(()=>{
  state.cache.clear();reads=0;name='统一地点';
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://place-fixture.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY','public-key');
  vi.stubGlobal('fetch',async(input: RequestInfo | URL,init?:RequestInit)=>{
    const url=new URL(String(input));
    expect(url.pathname).toBe('/rest/v1/places');
    expect(url.searchParams.get('status')).toBe('eq.published');
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer public-key');
    reads++;
    return Response.json([{id:'p1',name,category_slug:'food',status:'published',address:null,region:null,
      longitude:113.5,latitude:22.1,price_per_person:42,rating_average:null,review_count:0,
      legacy_image_urls:['https://example.test/shop.png'],place_tags:[{tags:{id:'t',slug:'student-discount',label_zh_mo:'学生价'}}],place_media:[]}]);
  });
});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe('retired shop HTTP compatibility alias',()=>{
  it('returns the same canonical records and shared cache through both HTTP paths',async()=>{
    const alias=await oldEndpoint(new Request('https://example.test/api/shops'));
    const current=await placeEndpoint(new Request('https://example.test/api/places'));
    const aliasItems = (await alias.json()).data.items;
    const canonicalItems = (await current.json()).data.items;
    const oldClient = mapShopList(aliasItems, 'zh-CN');
    expect(oldClient[0]).toMatchObject({id:'p1', name:'统一地点',imageUrls:['https://example.test/shop.png'],pricePerPerson:42,studentDiscount:'有学生优惠'});
    expect(canonicalItems[0]).toMatchObject({id:'p1',name:'统一地点',pricePerPerson:42});
    expect(reads).toBe(1);
  });
  it('retains authorization and cache invalidation for older clients',async()=>{
    await oldEndpoint(new Request('https://example.test/api/shops'));
    name='更新后地点';
    const denied=createShopCacheRefreshRoute({authorize:async()=>({ok:false as const,error:{code:'FORBIDDEN' as const,status:403,message:'denied'}}),client:()=>({}) as SupabaseClient});
    expect((await denied(new Request('https://example.test/api/admin/shops/refresh-cache',{method:'POST'}),{params:Promise.resolve({})})).status).toBe(403);
    const allowed=createShopCacheRefreshRoute({authorize:async()=>admin,client:()=>({}) as SupabaseClient});
    expect((await allowed(new Request('https://example.test/api/admin/shops/refresh-cache',{method:'POST'}),{params:Promise.resolve({})})).status).toBe(200);
    const body=await (await oldEndpoint(new Request('https://example.test/api/shops'))).json();
    expect(body.data.items[0].name).toBe('更新后地点');
  });
});
