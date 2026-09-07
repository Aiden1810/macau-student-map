import {describe, expect, it} from 'vitest';
import {
  mapAmapPois,
  mergeUniqueAmapPoiOptions,
  toLegacyShopPoiFields
} from '../../../lib/amap/place-search';

describe('AMap POI normalization', () => {
  it('filters POIs without an id or finite coordinates', () => {
    const options = mapAmapPois(
      [
        {id: 'valid', name: '校园汉堡', address: '大学大马路', location: {lng: 113.55, lat: 22.16}},
        {name: '缺少 ID', location: {lng: 113.55, lat: 22.16}},
        {id: 'bad-coordinate', name: '错误坐标', location: {lng: Number.POSITIVE_INFINITY, lat: 22.16}}
      ],
      '未命名地点'
    );

    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({placeId: 'valid', coordinates: [113.55, 22.16]});
  });

  it('combines the administrative area and POI address', () => {
    const [option] = mapAmapPois(
      [
        {
          id: 'poi-1',
          name: '澳门茶餐厅',
          pname: '澳门特别行政区',
          cityname: '澳门特别行政区',
          adname: '花地玛堂区',
          address: '关闸广场 1 号',
          location: {lng: 113.55, lat: 22.21}
        }
      ],
      '未命名地点'
    );

    expect(option.fullAddress).toBe('澳门特别行政区 澳门特别行政区 花地玛堂区 关闸广场 1 号');
  });

  it('keeps the first result when Macau and Zhuhai return the same provider id', () => {
    const macau = {placeId: 'same-id', name: '澳门结果', fullAddress: '澳门', coordinates: [113.55, 22.2] as [number, number]};
    const zhuhai = {placeId: 'same-id', name: '珠海结果', fullAddress: '珠海', coordinates: [113.56, 22.21] as [number, number]};

    expect(mergeUniqueAmapPoiOptions([macau], [zhuhai])).toEqual([macau]);
  });

  it('maps a selected provider POI to editable legacy shop fields', () => {
    const fields = toLegacyShopPoiFields(
      {
        placeId: 'B0FFTEST',
        name: '校园汉堡',
        fullAddress: '澳门氹仔大学大马路',
        coordinates: [113.5567, 22.1634]
      },
      '氹仔岛'
    );

    expect(fields).toEqual({
      name: '校园汉堡',
      address: '澳门氹仔大学大马路',
      amap_poi_id: 'B0FFTEST',
      longitude: '113.5567',
      latitude: '22.1634',
      region: '氹仔岛'
    });
    expect(fields).not.toHaveProperty('sourcePlaceId');
  });
});
