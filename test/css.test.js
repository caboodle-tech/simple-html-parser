import { test } from 'node:test';
import assert from 'node:assert';
import { SimpleHtmlParser, CSSParser } from '../src/simple-html-parser.js';

test('CSSParser - Basic parsing', async (t) => {
    const parser = new CSSParser();

    await t.test('parses simple CSS rule', () => {
        const css = '.card { background: white; }';
        const tree = parser.parse(css);
        
        assert.strictEqual(tree.type, 'css-root');
        assert.ok(tree.children.length > 0);
        
        const rule = tree.children.find(c => c.type === 'css-rule');
        assert.ok(rule);
        assert.strictEqual(rule.cssSelector, '.card');
        assert.strictEqual(rule.cssDeclarations['background'], 'white');
    });

    await t.test('parses multiple declarations', () => {
        const css = `
.container {
    margin: 0 auto;
    padding: 1rem;
    max-width: 1200px;
}`;
        const tree = parser.parse(css);
        const rule = tree.children.find(c => c.type === 'css-rule');
        
        assert.strictEqual(rule.cssDeclarations['margin'], '0 auto');
        assert.strictEqual(rule.cssDeclarations['padding'], '1rem');
        assert.strictEqual(rule.cssDeclarations['max-width'], '1200px');
    });

    await t.test('parses CSS variables', () => {
        const css = `:root {
    --primary-color: #007bff;
    --spacing: 1rem;
}`;
        const tree = parser.parse(css);
        const rule = tree.children.find(c => c.type === 'css-rule');
        
        assert.strictEqual(rule.cssDeclarations['--primary-color'], '#007bff');
        assert.strictEqual(rule.cssDeclarations['--spacing'], '1rem');
    });
});

test('CSSParser - Nested CSS', async (t) => {
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
        const card = tree.children.find(c => c.cssSelector === '.card');
        
        assert.ok(card);
        const title = card.children.find(c => c.cssSelector === '.title');
        assert.ok(title);
        assert.strictEqual(title.cssDeclarations['font-size'], '1.5rem');
    });
});

test('CSSParser - At-rules', async (t) => {
    const parser = new CSSParser();

    await t.test('parses @media queries', () => {
        const css = `
@media (max-width: 768px) {
    .container {
        padding: 0.5rem;
    }
}`;
        const tree = parser.parse(css);
        const media = tree.children.find(c => c.type === 'css-at-rule');
        
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
        const keyframes = tree.children.find(c => c.cssName === 'keyframes');
        
        assert.ok(keyframes);
        assert.ok(keyframes.cssParams.includes('fadeIn'));
    });

    await t.test('parses @import', () => {
        const css = `@import url('styles.css');`;
        const tree = parser.parse(css);
        const importRule = tree.children.find(c => c.cssName === 'import');
        
        assert.ok(importRule);
        assert.ok(importRule.cssParams.includes('styles.css'));
    });
});

test('CSSParser - Comments', async (t) => {
    const parser = new CSSParser();

    await t.test('parses CSS comments', () => {
        const css = `
/* This is a comment */
.card {
    background: white; /* inline comment */
}`;
        const tree = parser.parse(css);
        const comments = tree.children.filter(c => c.type === 'comment');
        
        assert.ok(comments.length > 0);
        assert.strictEqual(comments[0].commentType, 'css');
    });
});

test('SimpleHtmlParser - CSS in style tags', async (t) => {
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
        
        const names = variables.map(v => v.name);
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

test('CSSParser - Edge cases', async (t) => {
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
        const rule = tree.children.find(c => c.type === 'css-rule');
        
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
        const rule = tree.children.find(c => c.type === 'css-rule');
        
        assert.ok(rule.cssDeclarations['background'].includes('rgb'));
        assert.ok(rule.cssDeclarations['transform'].includes('translateX'));
    });
});