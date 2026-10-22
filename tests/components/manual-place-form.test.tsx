// @vitest-environment jsdom
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
vi.mock('next-intl', () => ({useTranslations: () => (key: string) => key}));
vi.mock('../../lib/supabase', () => ({supabase: {auth: {getSession: async () => ({data:{session:{access_token:'token'}}})}}}));
vi.mock('../../lib/api/client', () => ({authenticatedApiRequest: vi.fn()}));
vi.mock('../../components/ImageUpload', () => ({default: () => null}));
vi.mock('../../components/AmapPoiSelector', () => ({default: ({onSelect, onClearSelection, labels}: {onSelect: (value: unknown) => void; onClearSelection?: () => void; labels: {label:string}}) =>
  <><button type="button" onClick={() => onSelect({name:'附近酒吧',placeId:'landmark',fullAddress:'某街道',coordinates:[113.56,22.17]})}>{labels.label}</button>
    <button type="button" onClick={onClearSelection}>清除地标选择</button></>}));
import ContributionForm from '../../components/ContributionForm';
import {authenticatedApiRequest} from '../../lib/api/client';
import PlaceEditor from '../../components/admin/PlaceEditor';

let host: HTMLDivElement;
let root: Root;
const click = async (text: string) => {
  const button = [...host.querySelectorAll('button')].find(item => item.textContent === text || item.getAttribute('aria-label') === text);
  expect(button, `button: ${text}`).toBeDefined();
  await act(async () => button!.click());
};
const change = async (label: string, value: string) => {
  const control = [...host.querySelectorAll('label')].find(item => item.textContent?.includes(label))?.querySelector('input,textarea,select') as HTMLInputElement;
  expect(control, `input: ${label}`).toBeTruthy();
  const prototype = control.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : control.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(control,value);
    control.dispatchEvent(new Event(control.tagName === 'SELECT' ? 'change' : 'input',{bubbles:true}));
  });
};
beforeEach(() => {
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  HTMLDialogElement.prototype.showModal = function () {this.open=true;};
  HTMLDialogElement.prototype.close = function () {this.open=false;};
  host=document.createElement('div'); document.body.append(host); root=createRoot(host);
  vi.mocked(authenticatedApiRequest).mockReset().mockImplementation(async (path) => path.endsWith('/submit') ? {submitted:true} : {id:'draft',version:1});
});
afterEach(async () => {await act(async () => root.unmount());host.remove();});

describe('manual place contributions', () => {
  it('starts with store search and offers a stall form with manual location and preset business form', async () => {
    const pick = vi.fn();
    await act(async () => root.render(<ContributionForm manualCoordinates={null} onRequestMapPick={pick} onCancel={() => {}} onSuccess={() => {}} />));
    expect(host.querySelector('[aria-pressed="true"]')?.textContent).toContain('kindStore');
    await click('kindStall');
    expect(host.querySelector('form')).not.toBeNull();
    expect(host.querySelector('[aria-pressed="true"]')?.textContent).toContain('kindStall');
    expect(pick).not.toHaveBeenCalled();
    await change('manualNameLabel','口口相传的小摊');
    await change('位置描述','街口右侧');
    await click('搜索附近地标（可选）');
    await click('美食'); await click('小食');
    await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
    const payload = JSON.parse(String(vi.mocked(authenticatedApiRequest).mock.calls[0]?.[2]?.body));
    expect(payload.locationDetails).toMatchObject({businessForm:'stall',source:'manual',description:'街口右侧'});
  });
  it('preserves stall identity and entered directions while switching to map search and back', async () => {
    await act(async () => root.render(<ContributionForm manualCoordinates={null} onRequestMapPick={() => {}} onCancel={() => {}} onSuccess={() => {}} />));
    await click('kindStall');
    await change('manualNameLabel','烤冷面'); await change('位置描述','红色门口');
    await click('返回搜索店铺'); await click('searchLabel');
    await click('美食'); await click('小食');
    await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
    const payload = JSON.parse(String(vi.mocked(authenticatedApiRequest).mock.calls[0]?.[2]?.body));
    expect(payload.locationDetails).toMatchObject({businessForm:'stall',source:'map',description:'红色门口'});
  });
  it('lets a store use manual location without being recategorized as a stall', async () => {
    await act(async () => root.render(<ContributionForm manualCoordinates={null} onRequestMapPick={() => {}} onCancel={() => {}} onSuccess={() => {}} />));
    await click('manualSelectButton'); await click('搜索附近地标（可选）');
    await change('manualNameLabel','新开的店'); await change('位置描述','巷子最里面');
    await click('美食'); await click('小食');
    await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
    expect(JSON.parse(String(vi.mocked(authenticatedApiRequest).mock.calls[0]?.[2]?.body)).locationDetails.businessForm).toBe('store');
  });
  it('submits the stall name and finding directions without treating a landmark as the stall', async () => {
    await act(async () => root.render(<ContributionForm manualCoordinates={null} onRequestMapPick={() => {}} onCancel={() => {}} onSuccess={() => {}} />));
    await click('manualSelectButton');
    await click('搜索附近地标（可选）');
    await change('manualNameLabel','楼下烤冷面');
    await change('位置描述','酒吧门口右侧');
    await click('kindStall');
    await click('美食'); await click('小食');
    await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
    const payload = JSON.parse(String(vi.mocked(authenticatedApiRequest).mock.calls[0]?.[2]?.body));
    expect(payload.name).toBe('楼下烤冷面');
    expect(payload.locationDetails).toMatchObject({description:'酒吧门口右侧',landmark:'附近酒吧',businessForm:'stall',accuracy:'approximate'});
    expect(payload.longitude).toBe(113.56);
  });
  it('requires directions and offers a return to search with no stale landmark', async () => {
    await act(async () => root.render(<ContributionForm manualCoordinates={[113.55,22.16]} onRequestMapPick={() => {}} onCancel={() => {}} onSuccess={() => {}} />));
    await click('manualSelectButton');
    await act(async () => root.render(<ContributionForm manualCoordinates={[113.55,22.16]} onRequestMapPick={() => {}} onCancel={() => {}} onSuccess={() => {}} />));
    await change('manualNameLabel','烤冷面'); await click('美食'); await click('小食');
    await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
    expect(authenticatedApiRequest).not.toHaveBeenCalled();
    expect(host.textContent).toContain('位置描述');
    await click('返回搜索店铺');
    expect([...host.querySelectorAll('button')].some(item => item.textContent === 'searchLabel')).toBe(true);
    expect(host.querySelector('form')).toBeNull();
  });
  it('requires a fresh point after returning to search or clearing a reference landmark', async () => {
    const oldPoint: [number,number] = [113.55,22.16];
    await act(async () => root.render(<ContributionForm manualCoordinates={oldPoint} onRequestMapPick={() => {}} onCancel={() => {}} onSuccess={() => {}} />));
    await click('manualSelectButton');
    await click('返回搜索店铺'); await click('manualSelectButton');
    await change('manualNameLabel','新摊位'); await change('位置描述','新地点描述');
    await click('美食'); await click('小食');
    await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
    expect(authenticatedApiRequest).not.toHaveBeenCalled();
    await click('搜索附近地标（可选）'); await click('清除地标选择');
    await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
    expect(authenticatedApiRequest).not.toHaveBeenCalled();
  });
  it('keeps a manual submission identity when an admin searches a reference landmark', async () => {
    vi.mocked(authenticatedApiRequest).mockResolvedValue({id:'submission',name:'楼下烤冷面',nameEn:null,address:null,categorySlug:'food',region:null,
      longitude:113.55,latitude:22.16,pricePerPerson:null,tagIds:['00000000-0000-0000-0000-000000000109'],searchKeywords:[],status:'published',
      version:1,notes:null,media:[],locationDetails:{source:'manual',businessForm:'stall',accuracy:'approximate',mobility:'fixed',description:'酒吧门口右侧',landmark:null,hours:null}});
    await act(async () => root.render(<PlaceEditor target={{kind:'submission',id:'submission'}} onClose={() => {}} onSaved={() => {}} />));
    await click('搜索附近地标');
    const name = [...host.querySelectorAll('label')].find(item => item.textContent?.includes('地点名称'))!.querySelector('input')!;
    expect(name.value).toBe('楼下烤冷面');
    await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
    const publish = vi.mocked(authenticatedApiRequest).mock.calls.find(([url]) => url.endsWith('/publish'))!;
    expect(JSON.parse(String(publish[2]?.body)).place.locationDetails).toMatchObject({landmark:'附近酒吧',accuracy:'approximate'});
  });
});
