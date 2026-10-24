import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import nesting from 'tailwindcss/nesting';
import {describe, expect, it} from 'vitest';

describe('Tailwind selector parser compatibility', () => {
  it('keeps arbitrary, hover, group and responsive utilities after the security override', async () => {
    const result = await postcss([nesting(), tailwindcss({
      content: [{raw: '<div class="bg-[#006633] hover:bg-emerald-700 group-hover:text-white md:grid-cols-2 [&>span]:text-sm"></div>'}],
      corePlugins: {preflight: false}
    })]).process('@tailwind utilities; .compat { & > span { @apply text-sm; } }', {from: undefined});

    const rules: Array<{selector: string; declarations: Record<string, string>}> = [];
    result.root.walkRules(rule => {
      const declarations: Record<string, string> = {};
      rule.walkDecls(declaration => {declarations[declaration.prop] = declaration.value;});
      rules.push({selector: rule.selector, declarations});
    });

    expect(rules.some(rule => rule.declarations['background-color']?.includes('0 102 51'))).toBe(true);
    expect(rules.some(rule => rule.selector.includes(':hover') && rule.declarations['background-color'])).toBe(true);
    expect(rules.some(rule => rule.selector.includes('.group:hover ') && rule.declarations.color)).toBe(true);
    expect(rules.some(rule => rule.selector.includes('>span') && rule.declarations['font-size'] === '0.875rem')).toBe(true);
    expect(rules.some(rule => rule.selector === '.compat > span' && rule.declarations['font-size'] === '0.875rem')).toBe(true);

    let hasResponsiveGrid = false;
    result.root.walkAtRules('media', media => {
      if (media.params !== '(min-width: 768px)') return;
      media.walkDecls('grid-template-columns', declaration => {
        if (declaration.value === 'repeat(2, minmax(0, 1fr))') hasResponsiveGrid = true;
      });
    });
    expect(hasResponsiveGrid).toBe(true);
  });
});
