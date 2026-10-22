import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it} from 'vitest';
import PlaceLocationInfo from '../../components/PlaceLocationInfo';
import {getLocationCopyText, readLocationDetails} from '../../lib/domain/location-details';
import {mapCanonicalPlaceToShop} from '../../lib/mappers/canonical-shop';

const details = readLocationDetails({source:'manual',businessForm:'stall',accuracy:'approximate',mobility:'variable',
  description:'红色招牌右侧',landmark:'附近酒吧',hours:'通常晚上'});

describe('public manual place information', () => {
  it('shows directions and uncertainty without claiming to be open now', () => {
    const html = renderToStaticMarkup(<PlaceLocationInfo details={details} />);
    expect(html).toContain('红色招牌右侧'); expect(html).toContain('大致位置');
    expect(html).toContain('位置可能变化'); expect(html).toContain('仅供参考');
    expect(html).not.toContain('营业中');
  });
  it('lets people copy finding directions even without a street address', () => {
    const text = getLocationCopyText({name:'楼下烤冷面',address:'',locationDetails:details});
    expect(text).toContain('楼下烤冷面'); expect(text).toContain('红色招牌右侧');
    expect(text).toContain('附近酒吧'); expect(text).toContain('大致位置');
  });
  it('makes only explicitly recorded stalls eligible for the existing feature filter', () => {
    const row = {id:'a',name:'名字里有小摊',address:null,category_slug:'food' as const,region:null,
      longitude:113.55,latitude:22.16,price_per_person:null,rating_average:null,review_count:0,status:'published',legacy_image_urls:[]};
    expect(mapCanonicalPlaceToShop({...row,location_details:details}).features).toContain('小摊');
    expect(mapCanonicalPlaceToShop(row).features).not.toContain('小摊');
    expect(renderToStaticMarkup(<PlaceLocationInfo details={readLocationDetails()} />)).toBe('');
  });
});
