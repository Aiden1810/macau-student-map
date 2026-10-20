import {renderToStaticMarkup} from 'react-dom/server';
import {expect, it, vi} from 'vitest';
vi.mock('next-intl', () => ({useLocale: () => 'zh-CN', useTranslations: () => (key: string) => key}));
import MobilePlaceCard from '../../components/MobilePlaceCard';
import {mapCanonicalPlaceToShop} from '../../lib/mappers/canonical-shop';

it('shows concrete cuisine and group on compact mobile cards', () => {
  const shop = mapCanonicalPlaceToShop({id:'india',name:'餐厅',address:null,category_slug:'food',region:null,longitude:113.55,latitude:22.16,
    price_per_person:null,rating_average:null,review_count:0,status:'published',legacy_image_urls:[],
    place_tags:[{tags:{id:'indian',slug:'indian-cuisine',label_zh_mo:'印度菜'}}]});
  const markup = renderToStaticMarkup(<MobilePlaceCard shop={shop} favorite={false} highlighted={false} onLocate={() => {}} />);
  expect(markup).toContain('印度菜');
  expect(markup).toContain('其他菜系');
});
