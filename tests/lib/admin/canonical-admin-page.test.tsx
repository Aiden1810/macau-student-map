// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect, it, vi} from 'vitest';
const io = vi.hoisted(() => ({tables: [] as string[], request: vi.fn()}));
vi.mock('next-intl',()=>({useLocale:()=> 'zh-CN'}));
vi.mock('../../../i18n/navigation',()=>({Link:({children}: {children:React.ReactNode})=><span>{children}</span>}));
vi.mock('../../../lib/supabase',()=>({supabase:{auth:{getUser:async()=>({data:{user:{id:'admin'}},error:null})},from:(table:string)=>{
  io.tables.push(table);
  const query={select(){return this;},eq(){return this;},is(){return this;},gte(){return this;},order(){return this;},limit(){return this;},or(){return this;},
    maybeSingle:async()=>({data:{role:'admin'},error:null}),
    then(resolve:(value:unknown)=>unknown){return Promise.resolve({data:[],error:null,count:0}).then(resolve);}};
  return query;
},channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel(){}}}));
vi.mock('../../../components/admin/PlaceEditor',()=>({default:()=>null,adminEditorRequest:io.request}));
vi.mock('../../../components/admin/PlacesManager',()=>({default:()=>null}));
vi.mock('../../../components/admin/PlatformDashboard',()=>({default:()=>null}));
vi.mock('../../../components/admin/SubmissionQueue',()=>({default:()=>null}));
vi.mock('../../../components/admin/FeedbackInbox',()=>({default:()=>null}));
vi.mock('../../../components/admin/ReviewInbox',()=>({default:()=>null}));
vi.mock('../../../components/admin/UsersManager',()=>({default:()=>null}));
vi.mock('../../../components/admin/UsageDashboard',()=>({default:()=>null}));
import AdminPage from '../../../app/[locale]/admin/page';
it('reads analytics from canonical places and reviews without consulting legacy stores',async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  io.tables.length=0;
  io.request.mockResolvedValue({items:[{id:'p1',name:'统一测试地点',nameEn:null,address:'澳门',categorySlug:'food',region:'taipa',
    status:'published',longitude:113.5,latitude:22.1,pricePerPerson:30,tagIds:[],searchKeywords:[],media:[],createdAt:'2026-10-01',updatedAt:'2026-10-30'}, {id:'p2',name:'统一草稿地点',status:'draft',categorySlug:'food',tagIds:[],createdAt:'2026-10-01',pricePerPerson:null}]});
  vi.stubGlobal('fetch',async()=>Response.json({daily_no_hit_queries:[],weekly_keyword_breakdown:[],latest_events:[],sql_templates:{}}));
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  try{
    await act(async()=>root.render(<AdminPage/>));
    expect(host.textContent).toContain('统一测试地点');
    expect(io.tables).not.toContain('shops');
    expect(io.tables).not.toContain('comments');
    expect(io.tables).not.toContain('shop_comments');
    const status = [...host.querySelectorAll('select')].find(select => [...select.options].some(option => option.textContent === '全部状态'))!;
    await act(async()=>{status.value = [...status.options].find(option => option.textContent === '草稿')!.value; status.dispatchEvent(new Event('change',{bubbles:true}));});
    expect(host.textContent).toContain('统一草稿地点');
    expect(host.textContent).not.toContain('统一测试地点');
  }finally{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();}
});
