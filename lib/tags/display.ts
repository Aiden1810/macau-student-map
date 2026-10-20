import {findTaxonomyTag, getTaxonomyTagLabelZhCN, OTHER_CUISINE_SLUGS, resolveTagAlias} from '../domain/taxonomy';

/** Derive the group badge without adding a second tag to saved place data. */
export function withCuisineGroupLabel(tags: readonly string[], locale = 'zh-CN'): string[] {
  const result = [...new Set(tags)];
  const hasOtherCuisine = tags.some(value => {
    const exact = findTaxonomyTag(value);
    return (exact ? [exact] : resolveTagAlias(value)).some(tag => OTHER_CUISINE_SLUGS.includes(tag.slug));
  });
  if (hasOtherCuisine) {
    const group = findTaxonomyTag('other-cuisine')!;
    const label = locale === 'en' ? group.labelEn : locale === 'zh-MO' ? group.labelZhMO : getTaxonomyTagLabelZhCN(group.slug)!;
    if (!result.includes(label)) result.push(label);
  }
  return result;
}
