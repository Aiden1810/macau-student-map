// @vitest-environment jsdom
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const translate = vi.hoisted(() => (key: string) => key);
vi.mock('next-intl', () => ({useLocale: () => 'zh-CN', useTranslations: () => translate}));
vi.mock('../../lib/supabase', () => ({supabase: {}}));
vi.mock('next/image', () => ({
  default: ({src, alt, onError}: {src: string; alt: string; onError?: () => void}) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} onError={onError} />
  )
}));
vi.mock('../../i18n/navigation', () => ({
  Link: ({href, children, className}: {href: string; children: React.ReactNode; className?: string}) => (
    <a href={href} className={className}>{children}</a>
  )
}));

import ShopList from '../../components/ShopList';
import type {Shop} from '../../types/shop';

const makeShop = (id: string, name: string, imageUrls: string[]): Shop => ({
  id,
  name,
  type: '餐饮',
  category: 'food',
  status: 'verified',
  rating: 4.8,
  reviews: 5,
  studentDiscount: '',
  shopType: '快餐小吃',
  ratingLabel: '强烈推荐',
  tags: ['粉面'],
  features: [],
  coordinates: [113.54, 22.16],
  hasCoordinates: true,
  imageUrls,
  recommendStatus: 'recommend',
  address: `${name}地址`
});

describe('student recommendation cover thumbnails', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });

  it.each(['mobile', 'desktop'] as const)(
    'matches published shop cover by place_id on %s layout even when nearby filters narrow filteredShops, and falls back to placeholder when cover is missing or fails to load',
    async (layout) => {
      const publishedShops = [
        makeShop('place-1', '穆味王(氹仔店)', ['  ', 'https://example.com/muwei.jpg']),
        makeShop('place-2', '二师兄猪脚饭', [])
      ];

      await act(async () => {
        root.render(
          <ShopList
            layout={layout}
            filteredShops={[]}
            publishedShops={publishedShops}
            showStudentPicks={true}
            setShowStudentPicks={() => {}}
            studentRecommendations={{
              status: 'ready',
              result: {
                status: 'ready',
                items: [
                  {place_id: 'place-1', name: '穆味王(氹仔店)', address: '氹仔旧城区'},
                  {place_id: 'place-2', name: '二师兄猪脚饭', address: '城大附近'},
                  {place_id: 'place-3', name: '未匹配店铺', address: null}
                ]
              },
              retry: () => {}
            } as unknown as Parameters<typeof ShopList>[0]['studentRecommendations']}
            loading={false}
            searchQuery="筛选词"
            setSearchQuery={() => {}}
            onLocateShop={() => true}
            mobileSearchPlaceholder="搜索"
            emptyText="空"
            hasAnyShops={true}
            hasActiveFilters={true}
            activeFilterLabels={[]}
            onClearSearch={() => {}}
            onClearAllFilters={() => {}}
            drawerFilters={{shopType: '全部', ratingLabel: null, features: []}}
            onChangeDrawerFilters={() => {}}
          />
        );
      });

      const links = [...host.querySelectorAll<HTMLAnchorElement>('[data-student-recommendations] a')];
      expect(links).toHaveLength(3);
      expect(links.map(link => link.getAttribute('href'))).toEqual([
        '/shop/place-1',
        '/shop/place-2',
        '/shop/place-3'
      ]);

      const firstImg = links[0].querySelector('img');
      expect(firstImg?.getAttribute('src')).toBe('https://example.com/muwei.jpg');
      expect(firstImg?.getAttribute('alt')).toBe('穆味王(氹仔店)');
      expect(links[0].textContent).toContain('穆味王');
      expect(links[0].textContent).toContain('(氹仔店)');
      expect(links[0].textContent).toContain('氹仔旧城区');

      // Missing imageUrls[0] or unmatched place_id uses PlaceCover placeholder (Store icon SVG, no <img>).
      expect(links[1].querySelector('img')).toBeNull();
      expect(links[1].querySelector('svg')).not.toBeNull();
      expect(links[2].querySelector('img')).toBeNull();
      expect(links[2].querySelector('svg')).not.toBeNull();

      // Simulate image load error on first card -> switches to PlaceCover placeholder.
      await act(async () => {
        firstImg?.dispatchEvent(new Event('error'));
      });
      expect(links[0].querySelector('img')).toBeNull();
      expect(links[0].querySelector('svg')).not.toBeNull();
    }
  );
});
