import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it} from 'vitest';
import StarRating from '../../../components/StarRating';
describe('rating count explanation', () => {
  it('labels score-only reviews as people rating and warns about a small sample', () => {
    const html = renderToStaticMarkup(<StarRating score={5} reviewCount={1} />);
    expect(html).toContain('人评分');
    expect(html).toContain('仅供参考');
  });
  it('does not warn once five people have rated', () =>
    expect(renderToStaticMarkup(<StarRating score={4.8} reviewCount={5} />)).not.toContain('仅供参考'));
  it.each([0, -1, NaN, Infinity])('renders nothing for an absent or invalid score (%s)', score =>
    expect(renderToStaticMarkup(<StarRating score={score} reviewCount={0} />)).toBe(''));
  it('does not display an average when nobody has rated', () =>
    expect(renderToStaticMarkup(<StarRating score={4} reviewCount={0} />)).toBe(''));
});
