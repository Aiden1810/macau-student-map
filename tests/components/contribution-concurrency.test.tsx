// @vitest-environment jsdom
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

vi.mock('next-intl', () => ({useTranslations: () => (key: string) => key}));
vi.mock('../../lib/supabase', () => ({supabase: {auth: {
  getSession: async () => ({data: {session: {access_token: 'token'}}})
}}}));
vi.mock('../../lib/api/client', () => ({authenticatedApiRequest: vi.fn()}));
vi.mock('browser-image-compression', () => ({default: vi.fn()}));
vi.mock('../../components/AmapPoiSelector', () => ({default: ({onSelect}: {onSelect: (place: unknown) => void}) =>
  <button type="button" onClick={() => onSelect({name: '测试店', placeId: 'poi', fullAddress: '某街道', coordinates: [113.55, 22.16]})}>选择测试店</button>}));

import imageCompression from 'browser-image-compression';
import ContributionForm from '../../components/ContributionForm';
import {authenticatedApiRequest} from '../../lib/api/client';

let host: HTMLDivElement;
let root: Root;
const onCancel = vi.fn();
const onSuccess = vi.fn();
const button = (text: string) => [...host.querySelectorAll('button')].find(item => item.textContent === text)!;
const submit = () => host.querySelector('form')!.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
const file = new File(['local image'], 'test.jpg', {type: 'image/jpeg'});
async function pickImage() {
  const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, 'files', {configurable: true, value: [file]});
  await act(async () => input.dispatchEvent(new Event('change', {bubbles: true})));
}
async function prepareForm() {
  await act(async () => root.render(<ContributionForm manualCoordinates={null} onRequestMapPick={() => {}} onCancel={onCancel} onSuccess={onSuccess} />));
  await act(async () => button('选择测试店').click());
  await act(async () => button('美食').click());
  await act(async () => button('小食').click());
}
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});
  vi.mocked(imageCompression).mockImplementation(async image => image);
  vi.mocked(authenticatedApiRequest).mockImplementation(async path => path.endsWith('/submit')
    ? {submitted: true} : {id: 'draft', version: 1});
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {await act(async () => root.unmount()); host.remove();});

describe('contribution operations', () => {
  it('blocks submit and close throughout image compression and upload', async () => {
    await prepareForm();
    let finishCompression!: (image: File) => void;
    let finishUpload!: () => void;
    vi.mocked(imageCompression).mockImplementation(() => new Promise(resolve => {finishCompression = resolve;}));
    vi.mocked(authenticatedApiRequest).mockImplementation(path => path === '/api/media/submission-upload'
      ? new Promise<void>(resolve => {finishUpload = resolve;})
      : Promise.resolve(path.endsWith('/submit') ? {submitted: true} : {id: 'draft', version: 1}));
    await pickImage();
    expect(button('submit').matches(':disabled')).toBe(true);
    expect(button('close').matches(':disabled')).toBe(true);
    await act(async () => {submit(); button('close').click();});
    expect(authenticatedApiRequest).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    await act(async () => finishCompression(file));
    expect(button('submit').matches(':disabled')).toBe(true);
    expect(button('close').matches(':disabled')).toBe(true);
    await act(async () => {submit(); button('close').click();});
    expect(authenticatedApiRequest).toHaveBeenCalledTimes(2);
    expect(onCancel).not.toHaveBeenCalled();
    await act(async () => finishUpload());
    expect(host.textContent).toContain('已安全上传 1 张图片');
    expect(button('submit').matches(':disabled')).toBe(false);
    await act(async () => submit());
    expect(vi.mocked(authenticatedApiRequest).mock.calls.filter(([path]) => path === '/api/submissions')).toHaveLength(1);
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it('blocks image upload, repeated submit, and close while saving a submission', async () => {
    await prepareForm();
    let finishSave!: (draft: {id: string; version: number}) => void;
    vi.mocked(authenticatedApiRequest).mockImplementation(path => path === '/api/submissions'
      ? new Promise(resolve => {finishSave = resolve;}) : Promise.resolve({submitted: true}));
    await act(async () => submit());
    expect(button('上传图片').matches(':disabled')).toBe(true);
    expect(button('close').matches(':disabled')).toBe(true);
    await act(async () => {submit(); button('close').click();});
    expect(authenticatedApiRequest).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    await act(async () => finishSave({id: 'draft', version: 1}));
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it('blocks submit and repeated cancellation while deleting an uploaded draft', async () => {
    await prepareForm();
    await pickImage();
    let finishDelete!: () => void;
    vi.mocked(authenticatedApiRequest).mockImplementation((_path, _token, options) => options?.method === 'DELETE'
      ? new Promise<void>(resolve => {finishDelete = resolve;}) : Promise.resolve({id: 'draft', version: 1}));
    await act(async () => button('close').click());
    expect(button('submit').matches(':disabled')).toBe(true);
    expect(button('上传图片').matches(':disabled')).toBe(true);
    expect(button('close').matches(':disabled')).toBe(true);
    await act(async () => {submit(); button('close').click();});
    expect(vi.mocked(authenticatedApiRequest).mock.calls.filter(([, , options]) => options?.method === 'DELETE')).toHaveLength(1);
    await act(async () => finishDelete());
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('releases the form after a failed upload or cancellation so the user can retry', async () => {
    await prepareForm();
    vi.mocked(authenticatedApiRequest).mockImplementation(async path => {
      if (path === '/api/media/submission-upload') throw new Error('上传失败');
      return {id: 'draft', version: 1};
    });
    await pickImage();
    expect(host.textContent).toContain('上传失败');
    expect(button('submit').matches(':disabled')).toBe(false);
    expect(button('上传图片').matches(':disabled')).toBe(false);
    vi.mocked(authenticatedApiRequest).mockRejectedValueOnce(new Error('清理失败'));
    await act(async () => button('close').click());
    expect(host.textContent).toContain('清理失败');
    expect(button('close').matches(':disabled')).toBe(false);
    expect(button('submit').matches(':disabled')).toBe(false);
    expect(onCancel).not.toHaveBeenCalled();
  });
});
