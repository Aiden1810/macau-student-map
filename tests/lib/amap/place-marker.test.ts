import {describe, expect, it} from 'vitest';
import {buildPlacePinHtml} from '../../../lib/amap/place-marker';

describe('place marker HTML', () => {
  it.each(['default', 'selected'] as const)('renders type-specific icons in the %s state', size => {
    const hair = buildPlacePinHtml({category: 'service', tags: ['理发']}, size);
    const bar = buildPlacePinHtml({category: 'entertainment', tags: ['酒吧']}, size);
    expect(hair).toContain('data-place-icon="scissors"');
    expect(hair).toContain('理发');
    expect(bar).toContain('data-place-icon="wine"');
    expect(bar).not.toEqual(hair);
  });
  it('does not interpolate user input into marker HTML', () => {
    const html = buildPlacePinHtml({category: '<script>', tags: ['<img src=x onerror=alert(1)>']});
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('onerror');
    expect(html).toContain('data-place-icon="pin"');
  });
});
