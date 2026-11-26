import {describe, expect, it} from 'vitest';
import {activeMainSection} from '@/lib/navigation/main-sections';

describe('main navigation route ownership', () => {
  it.each([
    ['/', 'discover'], ['/shop/abc', 'discover'], ['/shop/abc/review/new', 'discover'],
    ['/choose', 'choose'], ['/choose/future-module', 'choose'], ['/me', 'me'],
    ['/meal-history', 'me'], ['/my-submissions', 'me'], ['/login', 'me'],
    ['/contact', null], ['/unknown', null], ['/admin/users', null], ['/me-old', null]
  ])('maps %s to the expected tab', (pathname, tab) => {
    expect(activeMainSection(pathname)).toBe(tab);
  });
});
