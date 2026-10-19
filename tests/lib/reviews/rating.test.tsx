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
  it('shows no rating instead of zero stars', () =>
    expect(renderToStaticMarkup(<StarRating score={0} reviewCount={0} />)).toContain('暂无评分'));
});
