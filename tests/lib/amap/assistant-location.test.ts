import {describe, expect, it} from 'vitest';
import {mapLocatedOrigin} from '../../../lib/amap/assistant-location';
describe('assistant origin', () => {
  it('uses AMap coordinates and administrative information together', () => {
    expect(
      mapLocatedOrigin(
        {
          position: {lng: 113.54, lat: 22.14},
          addressComponent: {city: '珠海市'},
        },
        '当前位置',
      ),
    ).toEqual({coordinates: [113.54, 22.14], label: '当前位置', city: '珠海'});
    expect(
      mapLocatedOrigin(
        {
          position: {lng: 113.55, lat: 22.19},
          addressComponent: {province: '澳门特别行政区'},
        },
        '当前位置',
      )?.city,
    ).toBe('澳门');
  });
  it('does not guess a city, accept an outside location, or treat null as 0', () => {
    expect(
      mapLocatedOrigin({position: {lng: 113.54, lat: 22.14}}, '当前位置'),
    ).toBeNull();
    expect(
      mapLocatedOrigin(
        {position: {lng: 116.4, lat: 39.9}, addressComponent: {city: '北京市'}},
        '当前位置',
      ),
    ).toBeNull();
    expect(
      mapLocatedOrigin(
        {position: null, addressComponent: {city: '珠海市'}},
        '当前位置',
      ),
    ).toBeNull();
  });
});
