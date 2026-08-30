import {describe, expect, it} from 'vitest';
import {placeSubmissionDraftSchema} from '../../../lib/domain/submission';
import {
  assertDraftOwner,
  findDuplicateCandidates,
  prepareSubmissionForSubmit
} from '../../../lib/services/submissions';

const burgerTagId = '00000000-0000-0000-0000-000000000501';
const clothingTagId = '00000000-0000-0000-0000-000000000601';

const validDraft = {
  name: '校園漢堡研究所',
  address: '澳門氹仔大學大馬路',
  categorySlug: 'food' as const,
  region: 'taipa',
  longitude: 113.5567,
  latitude: 22.1634,
  pricePerPerson: 58,
  tagIds: [burgerTagId],
  notes: null,
  sourcePlaceId: null,
  version: 1
};

describe('place submission validation', () => {
  it('rejects review and rating fields because those belong to the review flow', () => {
    expect(() => placeSubmissionDraftSchema.parse({...validDraft, ratingScore: 5})).toThrow();
    expect(() => placeSubmissionDraftSchema.parse({...validDraft, reviewText: '很好吃'})).toThrow();
  });

  it('requires coordinates and at least one canonical tag before submission', () => {
    expect(() => prepareSubmissionForSubmit({...validDraft, longitude: null})).toThrow(/longitude/i);
    expect(() => prepareSubmissionForSubmit({...validDraft, tagIds: []})).toThrow(/tag/i);
  });

  it('rejects a primary category tag that conflicts with the selected category', () => {
    expect(() =>
      prepareSubmissionForSubmit({...validDraft, tagIds: [clothingTagId]})
    ).toThrow(/category/i);
  });

  it('trims user text and returns a pending-row payload without rating fields', () => {
    expect(
      prepareSubmissionForSubmit({...validDraft, name: '  校園漢堡研究所  ', notes: ' 近北門 '})
    ).toEqual({
      source_place_id: null,
      name: '校園漢堡研究所',
      address: '澳門氹仔大學大馬路',
      category_slug: 'food',
      region: 'taipa',
      longitude: 113.5567,
      latitude: 22.1634,
      price_per_person: 58,
      tag_ids: [burgerTagId],
      notes: '近北門',
      status: 'pending',
      submitted_at: expect.any(String),
      version: 2
    });
  });
});

describe('submission ownership and duplicate discovery', () => {
  it('rejects updates by a user who does not own the draft', () => {
    expect(() => assertDraftOwner({submittedBy: 'owner-1'}, 'user-2')).toThrow(/owner/i);
  });

  it('returns nearby similarly named places but not distant or unrelated places', () => {
    const candidates = findDuplicateCandidates(validDraft, [
      {id: 'near', name: '校園漢堡研究所（氹仔）', longitude: 113.5568, latitude: 22.1635},
      {id: 'unrelated', name: '城大影印中心', longitude: 113.5568, latitude: 22.1635},
      {id: 'far', name: '校園漢堡研究所', longitude: 113.59, latitude: 22.2}
    ]);

    expect(candidates.map((candidate) => candidate.id)).toEqual(['near']);
    expect(candidates[0]?.distanceMeters).toBeLessThan(200);
  });
});
