import { test } from 'node:test';
import assert from 'node:assert';
import { SimpleHtmlParser, CSSParser } from '../src/simple-html-parser.js';

test('CSSParser - Basic parsing', async(t) => {
    const parser = new CSSParser();

    await t.test('parses simple CSS rule', () => {
        const css = '.card { background: white; }';
        const tree = parser.parse(css);

        assert.strictEqual(tree.type, 'css-root');
        assert.ok(tree.children.length > 0);

        const rule = tree.children.find((c) => { return c.type === 'css-rule'; });
        assert.ok(rule);
        assert.strictEqual(rule.cssSelector, '.card');
        assert.strictEqual(rule.cssDeclarations.background, 'white');
    });

    await t.test('parses multiple declarations', () => {
        const css = `
.container {
    margin: 0 auto;
    padding: 1rem;
    max-width: 1200px;
}`;
        const tree = parser.parse(css);
        const rule = tree.children.find((c) => { return c.type === 'css-rule'; });

        assert.strictEqual(rule.cssDeclarations.margin, '0 auto');
        assert.strictEqual(rule.cssDeclarations.padding, '1rem');
        assert.strictEqual(rule.cssDeclarations['max-width'], '1200px');
    });

    await t.test('parses CSS variables', () => {
        const css = `:root {
    --primary-color: #007bff;
    --spacing: 1rem;
}`;
        const tree = parser.parse(css);
        const rule = tree.children.find((c) => { return c.type === 'css-rule'; });

        assert.strictEqual(rule.cssDeclarations['--primary-color'], '#007bff');
        assert.strictEqual(rule.cssDeclarations['--spacing'], '1rem');
    });
});

test('CSSParser - Nested CSS', async(t) => {
    const parser = new CSSParser();

    await t.test('parses nested selectors', () => {
        const css = `
.card {
    background: white;
    
    .title {
        font-size: 1.5rem;
    }
}`;
        const tree = parser.parse(css);
        const card = tree.children.find((c) => { return c.cssSelector === '.card'; });

        assert.ok(card);
        const title = card.children.find((c) => { return c.cssSelector === '.title'; });
        assert.ok(title);
        assert.strictEqual(title.cssDeclarations['font-size'], '1.5rem');
    });
});

test('CSSParser - At-rules', async(t) => {
    const parser = new CSSParser();

    await t.test('parses @media queries', () => {
        const css = `
@media (max-width: 768px) {
    .container {
        padding: 0.5rem;
    }
}`;
        const tree = parser.parse(css);
        const media = tree.children.find((c) => { return c.type === 'css-at-rule'; });

        assert.ok(media);
        assert.strictEqual(media.cssName, 'media');
        assert.ok(media.cssParams.includes('max-width: 768px'));
    });

    await t.test('parses @keyframes', () => {
        const css = `
@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}`;
        const tree = parser.parse(css);
        const keyframes = tree.children.find((c) => { return c.cssName === 'keyframes'; });

        assert.ok(keyframes);
        assert.ok(keyframes.cssParams.includes('fadeIn'));
    });

    await t.test('parses @import', () => {
        const css = `@import url('styles.css');`;
        const tree = parser.parse(css);
        const importRule = tree.children.find((c) => { return c.cssName === 'import'; });

        assert.ok(importRule);
        assert.ok(importRule.cssParams.includes('styles.css'));
    });
});

test('CSSParser - Comments', async(t) => {
    const parser = new CSSParser();

    await t.test('parses CSS comments', () => {
        const css = `
/* This is a comment */
.card {
    background: white; /* inline comment */
}`;
        const tree = parser.parse(css);
        const comments = tree.children.filter((c) => { return c.type === 'comment'; });

        assert.ok(comments.length > 0);
        assert.strictEqual(comments[0].commentType, 'css');
    });
});

test('SimpleHtmlParser - CSS in style tags', async(t) => {
    const parser = new SimpleHtmlParser();

    await t.test('parses style tag content as CSS', () => {
        const html = `<style>
.card {
    background: white;
    padding: 1rem;
}
</style>`;
        const dom = parser.parse(html);
        const style = dom.querySelector('style');

        assert.ok(style.styleBlock);
        assert.ok(style.children.length > 0);
    });

    await t.test('cssFindRules finds rules', () => {
        const html = `<style>
.card { background: white; }
.card.active { background: blue; }
.button { color: black; }
</style>`;
        const dom = parser.parse(html);
        const style = dom.querySelector('style');

        const cardRules = style.cssFindRules('.card');
        assert.strictEqual(cardRules.length, 2);

        const exactCard = style.cssFindRules('.card', { includeCompound: false });
        assert.strictEqual(exactCard.length, 1);
    });

    await t.test('cssFindRules matches tags case-insensitively', () => {
        const html = `<style>
P { margin: 10px; }
p { padding: 5px; }
DIV { display: block; }
</style>`;
        const dom = parser.parse(html);
        const style = dom.querySelector('style');

        // Should find both P and p
        const pRules = style.cssFindRules('p');
        assert.strictEqual(pRules.length, 2, 'Should find both P and p');

        // Should find DIV
        const divRules = style.cssFindRules('div');
        assert.strictEqual(divRules.length, 1, 'Should find DIV');
    });

    await t.test('cssFindVariable finds CSS variables', () => {
        const html = `<style>
:root {
    --primary: #007bff;
    --secondary: #6c757d;
}
</style>`;
        const dom = parser.parse(html);
        const style = dom.querySelector('style');

        const primary = style.cssFindVariable('--primary');
        assert.strictEqual(primary, '#007bff');

        const secondary = style.cssFindVariable('secondary'); // without --
        assert.strictEqual(secondary, '#6c757d');
    });

    await t.test('cssFindVariables returns all variables', () => {
        const html = `<style>
:root {
    --primary: #007bff;
    --spacing: 1rem;
}
.card {
    --card-bg: white;
}
</style>`;
        const dom = parser.parse(html);
        const style = dom.querySelector('style');

        const variables = style.cssFindVariables();
        assert.strictEqual(variables.length, 3);

        const names = variables.map((v) => { return v.name; });
        assert.ok(names.includes('--primary'));
        assert.ok(names.includes('--spacing'));
        assert.ok(names.includes('--card-bg'));
    });

    await t.test('cssFindAtRules finds at-rules', () => {
        const html = `<style>
@media (max-width: 768px) {
    .container { padding: 0.5rem; }
}
@media (max-width: 480px) {
    .container { padding: 0.25rem; }
}
@keyframes fadeIn {
    from { opacity: 0; }
}
</style>`;
        const dom = parser.parse(html);
        const style = dom.querySelector('style');

        const allAtRules = style.cssFindAtRules();
        assert.strictEqual(allAtRules.length, 3);

        const mediaRules = style.cssFindAtRules('media');
        assert.strictEqual(mediaRules.length, 2);

        const keyframes = style.cssFindAtRules('keyframes');
        assert.strictEqual(keyframes.length, 1);
    });

    await t.test('cssToString finds all style tags and combines CSS', () => {
        const html = `<div>
    <style>
        .card { background: white; }
        .button { color: blue; }
    </style>
    <section>
        <style>
            .card { padding: 1rem; }
            .link { text-decoration: none; }
        </style>
    </section>
</div>`;
        const dom = parser.parse(html);
        const div = dom.querySelector('div');

        // Call on div - should find both style tags
        const css = div.cssToString();

        // Should have all selectors
        assert.ok(css.includes('.card'), 'Should include .card');
        assert.ok(css.includes('.button'), 'Should include .button');
        assert.ok(css.includes('.link'), 'Should include .link');

        // With combineDeclarations: true (default), .card should appear once with both properties
        const cardMatches = css.match(/\.card\s*{/g);
        assert.strictEqual(cardMatches.length, 1, '.card should be combined into one rule');
        assert.ok(css.includes('background: white'), 'Should have background');
        assert.ok(css.includes('padding: 1rem'), 'Should have padding');

        // With combineDeclarations: false, .card should appear twice
        const cssNotCombined = div.cssToString({ combineDeclarations: false });
        const cardMatchesNotCombined = cssNotCombined.match(/\.card\s*{/g);
        assert.strictEqual(cardMatchesNotCombined.length, 2, '.card should appear twice when not combining');
    });

    await t.test('cssToString combineDeclarations merges rules with same selector', () => {
        const html = `<style>
.link { color: blue; }
p { margin: 10px; }
.link { text-decoration: none; }
.link { font-weight: bold; }
p { padding: 5px; }
</style>`;
        const dom = parser.parse(html);
        const style = dom.querySelector('style');

        // With combineDeclarations: true (default)
        const combined = style.cssToString({ combineDeclarations: true });

        // Should have 2 rule blocks (one for .link, one for p)
        const linkMatches = combined.match(/\.link\s*{/g);
        const pMatches = combined.match(/p\s*{/g);

        assert.strictEqual(linkMatches.length, 1, '.link should appear once');
        assert.strictEqual(pMatches.length, 1, 'p should appear once');

        // .link should have all 3 declarations
        assert.ok(combined.includes('color: blue'));
        assert.ok(combined.includes('text-decoration: none'));
        assert.ok(combined.includes('font-weight: bold'));

        // p should have both declarations
        assert.ok(combined.includes('margin: 10px'));
        assert.ok(combined.includes('padding: 5px'));

        // With combineDeclarations: false
        const notCombined = style.cssToString({ combineDeclarations: false });

        // Should have 5 separate rule blocks
        const linkMatchesNotCombined = notCombined.match(/\.link\s*{/g);
        const pMatchesNotCombined = notCombined.match(/p\s*{/g);

        assert.strictEqual(linkMatchesNotCombined.length, 3, '.link should appear 3 times');
        assert.strictEqual(pMatchesNotCombined.length, 2, 'p should appear 2 times');
    });

    await t.test('reconstructs CSS back to string', () => {
        const html = `<style>
.card {
    background: white;
    padding: 1rem;
}
</style>`;
        const dom = parser.parse(html);
        const output = dom.toHtml();

        assert.ok(output.includes('.card'));
        assert.ok(output.includes('background: white'));
        assert.ok(output.includes('padding: 1rem'));
    });
});

test('CSSParser - Edge cases', async(t) => {
    const parser = new CSSParser();

    await t.test('handles empty CSS', () => {
        const css = '';
        const tree = parser.parse(css);

        assert.strictEqual(tree.type, 'css-root');
        assert.strictEqual(tree.children.length, 0);
    });

    await t.test('handles CSS with only whitespace', () => {
        const css = '   \n\n   ';
        const tree = parser.parse(css);

        assert.strictEqual(tree.type, 'css-root');
    });

    await t.test('handles complex selectors', () => {
        const css = `
div > p.highlight[data-id="123"]:not(.disabled) {
    color: red;
}`;
        const tree = parser.parse(css);
        const rule = tree.children.find((c) => { return c.type === 'css-rule'; });

        assert.ok(rule);
        assert.ok(rule.cssSelector.includes('p.highlight'));
    });

    await t.test('handles values with parentheses', () => {
        const css = `
.element {
    background: rgb(255, 255, 255);
    transform: translateX(10px) rotate(45deg);
}`;
        const tree = parser.parse(css);
        const rule = tree.children.find((c) => { return c.type === 'css-rule'; });

        assert.ok(rule.cssDeclarations.background.includes('rgb'));
        assert.ok(rule.cssDeclarations.transform.includes('translateX'));
    });
});
