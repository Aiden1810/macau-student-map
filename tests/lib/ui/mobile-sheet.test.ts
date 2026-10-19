import {describe, expect, it} from 'vitest';
import {getSheetHeights, resolveSheetDrag} from '../../../lib/ui/mobile-sheet';

describe('mobile shop sheet snapping', () => {
  it('provides a fully hidden position and keeps visible positions inside a short viewport', () => {
    expect(getSheetHeights(844, 142)).toEqual({hidden: 0, collapsed: 320, full: 698});
    expect(getSheetHeights(390, 142)).toEqual({hidden: 0, collapsed: 244, full: 244});
  });
  it('hides a half-open sheet after a downward gesture', () => {
    expect(resolveSheetDrag('collapsed', 320, -70, 698)).toBe('hidden');
  });
  it('moves a full sheet down to the middle after a modest downward gesture', () => {
    expect(resolveSheetDrag('full', 698, -70, 698)).toBe('collapsed');
  });
  it('supports a long downward drag all the way to the hidden position', () => {
    expect(resolveSheetDrag('full', 698, -650, 698)).toBe('hidden');
  });
  it('expands a middle sheet with an upward gesture', () => {
    expect(resolveSheetDrag('collapsed', 320, 70, 698)).toBe('full');
  });
  it('does not collapse from a tap or minor movement', () => {
    expect(resolveSheetDrag('collapsed', 320, -6, 698)).toBe('collapsed');
    expect(resolveSheetDrag('full', 698, 0, 698)).toBe('full');
  });
  it('does not snap to an indistinguishable middle position on a short screen', () => {
    expect(resolveSheetDrag('full', 244, -70, 244)).toBe('hidden');
  });
});
