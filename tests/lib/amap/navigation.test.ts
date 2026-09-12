import {describe, expect, it} from 'vitest';
import {buildAmapNavigationUrl} from '../../../lib/amap/navigation';

const destination = {
  name: '芬记烧腊（新业大厦店）',
  coordinates: [113.54265, 22.193077] as [number, number],
  hasCoordinates: true
};

describe('AMap navigation destinations', () => {
  it('opens a walking route to the exact branch in longitude-latitude order', () => {
    const url = new URL(buildAmapNavigationUrl(destination)!);

    expect(url.origin + url.pathname).toBe('https://uri.amap.com/navigation');
    expect(url.searchParams.get('to')).toBe('113.54265,22.193077,芬记烧腊（新业大厦店）');
    expect(url.searchParams.get('mode')).toBe('walk');
    expect(url.searchParams.get('callnative')).toBe('1');
    // Let the map provider obtain the starting point; never invent one.
    expect(url.searchParams.has('from')).toBe(false);
  });

  it('offers the same destination on the web without attempting to open an app', () => {
    const url = new URL(buildAmapNavigationUrl(destination, {callNative: false})!);

    expect(url.searchParams.get('callnative')).toBe('0');
    expect(url.searchParams.get('to')).toBe('113.54265,22.193077,芬记烧腊（新业大厦店）');
    expect(url.searchParams.get('mode')).toBe('walk');
  });

  it('does not let punctuation in a place name replace navigation parameters', () => {
    const url = new URL(buildAmapNavigationUrl({
      ...destination,
      name: '  Café A&B,氹仔店\n#2?mode=car&to=0,0  '
    })!);

    expect(url.searchParams.get('to')).toBe('113.54265,22.193077,Café A&B 氹仔店 #2?mode=car&to=0 0');
    expect(url.searchParams.get('mode')).toBe('walk');
    expect(url.searchParams.getAll('to')).toHaveLength(1);
    expect(url.hash).toBe('');
  });

  it('keeps equally named branches at their own coordinates without coordinate conversion', () => {
    const secondBranch = new URL(buildAmapNavigationUrl({
      ...destination,
      coordinates: [113.56, 22.15]
    })!);

    expect(secondBranch.searchParams.get('to')).toBe('113.56,22.15,芬记烧腊（新业大厦店）');
  });

  it('refuses default coordinates when the place says its location is unknown', () => {
    expect(buildAmapNavigationUrl({...destination, hasCoordinates: false})).toBeNull();
  });

  it.each([
    [0, 0],
    [NaN, 22.19],
    [113.54, Infinity],
    [181, 22.19],
    [-181, 22.19],
    [113.54, 91],
    [113.54, -91],
    [22.19, 113.54]
  ])('refuses unusable destination coordinates [%s, %s]', (longitude, latitude) => {
    expect(buildAmapNavigationUrl({
      ...destination,
      coordinates: [longitude, latitude]
    })).toBeNull();
  });
});
