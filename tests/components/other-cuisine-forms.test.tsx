// @vitest-environment jsdom
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
vi.mock('next-intl', () => ({useTranslations: () => (key: string) => key}));
vi.mock('../../lib/supabase', () => ({supabase: {auth: {getSession: vi.fn()}}}));
vi.mock('../../components/AmapPoiSelector', () => ({default: () => null}));
vi.mock('../../components/ImageUpload', () => ({default: () => null}));
import ContributionForm from '../../components/ContributionForm';
import PlaceEditor from '../../components/admin/PlaceEditor';

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});
  HTMLDialogElement.prototype.showModal = function () {this.open = true;};
  HTMLDialogElement.prototype.close = function () {this.open = false;};
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {await act(async () => root.unmount()); host.remove();});
describe('shared other-cuisine interaction', () => {
  it.each(['contribution', 'admin'])('nests concrete tags in %s without selecting a parent on expansion', async form => {
    await act(async () => root.render(form === 'admin'
      ? <PlaceEditor target={{kind: 'create'}} onClose={() => {}} onSaved={() => {}} />
      : <ContributionForm onSuccess={() => {}} onCancel={() => {}} onRequestMapPick={() => {}} manualCoordinates={[113.55, 22.16]} />));
    if (form === 'contribution') {
      await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === 'manualSelectButton')!.click());
      await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === '美食')!.click());
    }
    const summary = [...host.querySelectorAll('summary')].find(element => element.textContent?.includes('其他菜系'));
    expect(summary, 'other cuisines should be an expandable group').toBeDefined();
    const group = summary!.closest('details')!;
    expect([...group.querySelectorAll('button')].map(button => button.textContent)).toEqual(['印度菜', '东南亚菜', '其他／暂未细分']);
    await act(async () => (summary as HTMLElement).click());
    expect(group.open).toBe(true);
    expect(group.querySelector('[aria-pressed="true"]')).toBeNull();
    await act(async () => group.querySelector('button')!.click());
    expect(group.querySelector('button')!.getAttribute('aria-pressed')).toBe('true');
    expect([...group.querySelectorAll('[aria-pressed="true"]')].map(button => button.textContent)).toEqual(['印度菜']);
    await act(async () => group.querySelector('button')!.click());
    expect(group.querySelector('[aria-pressed="true"]')).toBeNull();
  });
});
