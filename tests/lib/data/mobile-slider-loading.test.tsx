// @vitest-environment jsdom
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
vi.mock('next-intl', () => ({useTranslations: () => (key: string) => key}));
import MobileImageSlider from '../../../components/MobileImageSlider';

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {await act(async () => root.unmount()); host.remove();});
const images = ['/one.jpg', '/two.jpg', '/three.jpg', '/four.jpg', '/five.jpg'];

describe('mobile gallery image requests', () => {
  it('mounts only the current and adjacent images, then loads neighbors after a swipe', async () => {
    await act(async () => root.render(<MobileImageSlider images={images} />));
    expect(host.querySelectorAll('img')).toHaveLength(2);
    const scroller = host.querySelector('.snap-x') as HTMLDivElement;
    Object.defineProperty(scroller, 'clientWidth', {value: 300});
    scroller.scrollLeft = 600;
    await act(async () => scroller.dispatchEvent(new Event('scroll')));
    expect(host.querySelectorAll('img')).toHaveLength(3);
    expect([...host.querySelectorAll('img')].map(img => img.alt)).toEqual([
      'shop-mobile-image-2', 'shop-mobile-image-3', 'shop-mobile-image-4'
    ]);
  });
  it('keeps all slide controls and their original lightbox indexes', async () => {
    const open = vi.fn();
    await act(async () => root.render(<MobileImageSlider images={images} onOpenLightbox={open} />));
    expect(host.querySelectorAll('button')).toHaveLength(5);
    await act(async () => host.querySelectorAll('button')[4].click());
    expect(open).toHaveBeenCalledWith(4);
  });
  it('resets a changed gallery instead of applying the previous shop slide index', async () => {
    await act(async () => root.render(<MobileImageSlider images={images} />));
    const scroller = host.querySelector('.snap-x') as HTMLDivElement;
    Object.defineProperty(scroller, 'clientWidth', {value: 300});
    scroller.scrollLeft = 1200;
    await act(async () => scroller.dispatchEvent(new Event('scroll')));
    expect(host.textContent).toContain('5 / 5');
    await act(async () => root.render(<MobileImageSlider images={['/new-one.jpg', '/new-two.jpg', '/new-three.jpg']} />));
    expect(host.textContent).toContain('1 / 3');
    expect(host.querySelectorAll('img')).toHaveLength(2);
  });
});
