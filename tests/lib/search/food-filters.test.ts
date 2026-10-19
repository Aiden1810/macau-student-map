import {describe, expect, it} from 'vitest';
import {filterFoodPlaces} from '../../../lib/search/food-filters';
import {mapSingleShop} from '../../../lib/mappers/shop';

const places = [
  {id: 'noodles', tags: ['中餐', '牛肉面']},
  {id: 'siu-mei', tags: ['快餐', '燒臘']},
  {id: 'generic-chinese', tags: ['中餐']},
  {id: 'generic-fast', tags: ['快餐']},
  {id: 'bbq', tags: ['烤肉']},
  {id: 'coffee', tags: ['咖啡']},
  {id: 'dessert', tags: ['甜品']}
];
const ids = (values: string[]) => filterFoodPlaces(values, places).map(place => place.id);

describe('food filters', () => {
  it('matches original manual tags even when the displayed tags are translated', () => {
    const noodle = mapSingleShop({id: 'n', name: '面店', main_category: '粉面', tags: ['粉面'], tags_i18n: {en: ['Noodles']}}, 'en');
    const roast = mapSingleShop({id: 'r', name: '烧腊店', tags: ['烧腊'], tags_i18n: {en: ['Roast meats']}}, 'en');
    expect(filterFoodPlaces(['food-noodles'], [noodle, roast]).map(place => place.id)).toEqual(['n']);
    expect(filterFoodPlaces(['food-siu-mei'], [noodle, roast]).map(place => place.id)).toEqual(['r']);
  });
  it('matches noodles and roast meats only from explicit manually recorded tags', () => {
    expect(ids(['food-noodles'])).toEqual(['noodles']);
    expect(ids(['food-siu-mei'])).toEqual(['siu-mei']);
    expect(ids(['food-noodles', 'food-siu-mei'])).toEqual(['noodles', 'siu-mei']);
  });
  it('keeps canonical tag matching for barbecue, coffee and desserts', () => {
    expect(ids(['barbecue', 'coffee', 'dessert'])).toEqual(['bbq', 'coffee', 'dessert']);
    expect(ids([])).toEqual(places.map(place => place.id));
    expect(ids(['unknown'])).toEqual([]);
  });
});
