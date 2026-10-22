import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it, vi} from 'vitest';
vi.mock('next-intl', () => ({useLocale: () => 'zh-MO', useTranslations: () => (key: string) => key}));
import ReviewInvitation from '../../components/reviews/ReviewInvitation';

describe('first review invitation', () => {
  it('links to the existing localized review page instead of submitting a review', () => {
    const html = renderToStaticMarkup(<ReviewInvitation placeId="place-1" />);
    expect(html).toContain('emptyReviews');
    expect(html).toContain('writeFirstReview');
    expect(html).toContain('href="/zh-MO/shop/place-1/review/new"');
    expect(html).not.toContain('<form');
  });
});
