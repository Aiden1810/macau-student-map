import {describe, expect, it} from 'vitest';
import {brandName, createManifest} from '../../lib/brand';
import {contactCopy} from '../../lib/contact/copy';

describe('localized Chengmi brand', () => {
  it.each([['zh-CN', '城觅'], ['zh-MO', '城覓'], ['en', 'Chengmi']])('uses %s in the brand, manifest and contact copy', (locale, name) => {
    expect(brandName(locale)).toBe(name);
    expect(createManifest(locale)).toMatchObject({name, short_name: name, lang: locale, start_url: `/${locale}`});
    expect(contactCopy(locale).feedbackTitle).toContain(name);
    expect(JSON.stringify(contactCopy(locale))).not.toContain('CityU Food');
  });
});
