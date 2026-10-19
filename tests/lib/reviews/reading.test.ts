import {describe,expect,it,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {createReviewHandlers} from '../../../lib/reviews/handlers';

const id='11111111-1111-4111-8111-111111111111';
const time='2026-10-19T00:00:00.123456+00:00';
const review={id,place_id:id,user_id:'private-author',rating:4,content:'真实评价',status:'published',moderation_status:'pending',moderation_reason:'private-reason',deleted_at:null,created_at:time,updated_at:time,places:{name:'测试店'}};
function setup(){
  const placeQuery={select:vi.fn(),or:vi.fn(),eq:vi.fn(),limit:vi.fn(),maybeSingle:vi.fn().mockResolvedValue({data:{id,rating_average:4,review_count:1},error:null})};
  for(const key of ['select','or','eq','limit'] as const)placeQuery[key].mockReturnValue(placeQuery);
  const result={data:[review],error:null,count:1};
  const reviewQuery={select:vi.fn(),eq:vi.fn(),is:vi.fn(),not:vi.fn(),order:vi.fn(),limit:vi.fn(),range:vi.fn().mockResolvedValue(result),maybeSingle:vi.fn().mockResolvedValue({data:review,error:null}),then:Promise.resolve(result).then.bind(Promise.resolve(result))};
  for(const key of ['select','eq','is','not','order','limit'] as const)reviewQuery[key].mockReturnValue(reviewQuery);
  const client={from:vi.fn((table:string)=>table==='places'?placeQuery:reviewQuery)} as unknown as SupabaseClient;
  const user={ok:true as const,user:{id:'private-author'},accessToken:'test'};
  const handlers=createReviewHandlers({client:()=>client,publicClient:()=>client,authorizeUser:async()=>user,authorizeAdmin:async()=>({...user,role:'admin' as const})});
  return {handlers,reviewQuery};
}
const context={params:Promise.resolve({id})};
describe('review read endpoints',()=>{
  it('returns public scores without author identifiers or moderation notes',async()=>{
    const {handlers,reviewQuery}=setup();
    const response=await handlers.GET(new Request('http://localhost'),context);
    expect(response.status).toBe(200);
    const data=(await response.json()).data;
    expect(data.summary).toEqual({average:4,count:1});
    expect(data.items[0]).toEqual({id,placeId:id,rating:4,content:'真实评价',createdAt:time,updatedAt:time});
    expect(JSON.stringify(data)).not.toContain('private-');
    expect(reviewQuery.eq).toHaveBeenCalledWith('status','published');expect(reviewQuery.is).toHaveBeenCalledWith('deleted_at',null);
  });
  it('returns my version and review status for safe editing',async()=>{
    const {handlers,reviewQuery}=setup();
    const response=await handlers.MINE(new Request('http://localhost'),context);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect((await response.json()).data.review.updatedAt).toBe(time);
    expect(reviewQuery.eq).toHaveBeenCalledWith('user_id','private-author');
  });
  it('paginates the administrator queue and filters moderation separately from visibility',async()=>{
    const {handlers,reviewQuery}=setup();
    const response=await handlers.ADMIN_LIST(new Request('http://localhost/api/admin/reviews?status=pending&page=1'));
    expect(response.status).toBe(200);expect(reviewQuery.range).toHaveBeenCalledWith(20,39);
    expect(reviewQuery.eq).toHaveBeenCalledWith('moderation_status','pending');
    expect(reviewQuery.eq).not.toHaveBeenCalledWith('status','pending');
    expect((await response.json()).data.items[0].placeName).toBe('测试店');
  });
  it('allows administrators to inspect soft-deleted records without returning them to the public',async()=>{
    const {handlers,reviewQuery}=setup();
    await handlers.ADMIN_LIST(new Request('http://localhost/api/admin/reviews?status=deleted'));
    expect(reviewQuery.not).toHaveBeenCalledWith('deleted_at','is',null);
  });
});
