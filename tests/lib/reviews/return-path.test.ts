import {describe, expect, it} from 'vitest';
import {safeReturnPath} from '../../../lib/auth/return-path';
describe('login return path', () => {
  it('keeps local review paths and their locale', () =>
    expect(safeReturnPath('/zh-CN/shop/abc/review/new')).toBe('/zh-CN/shop/abc/review/new'));
  it.each([
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    '/%2f%2fevil.example',
    '/zh-CN/login?next=x',
    '/zh-CN/auth/callback',
    null
  ])('blocks unsafe destinations and login loops: %s', (value) => expect(safeReturnPath(value)).toBe('/'));
});
