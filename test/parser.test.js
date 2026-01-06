import { test } from 'node:test';
import assert from 'node:assert';
import { SimpleHtmlParser } from '../src/simple-html-parser.js';

test('SimpleHtmlParser - Basic parsing', async(t) => {
    const parser = new SimpleHtmlParser();

    await t.test('parses simple HTML', () => {
        const html = '<div>Hello World</div>';
        const dom = parser.parse(html);

        assert.strictEqual(dom.type, 'root');
        assert.strictEqual(dom.children.length, 2);
        assert.strictEqual(dom.children[0].type, 'tag-open');
        assert.strictEqual(dom.children[0].name, 'div');
        assert.strictEqual(dom.children[1].type, 'tag-close');
    });

    await t.test('parses nested elements', () => {
        const html = '<div><p>Text</p></div>';
        const dom = parser.parse(html);

        const div = dom.querySelector('div');
        const p = dom.querySelector('p');

        assert.ok(div);
        assert.ok(p);
        assert.strictEqual(p.parent, div);
    });

    await t.test('parses attributes', () => {
        const html = '<div id="app" class="container" data-value="123"></div>';
        const dom = parser.parse(html);
        const div = dom.querySelector('div');

        assert.strictEqual(div.getAttribute('id'), 'app');
        assert.strictEqual(div.getAttribute('class'), 'container');
        assert.strictEqual(div.getAttribute('data-value'), '123');
    });

    await t.test('preserves text content', () => {
        const html = '<p>Hello World</p>';
        const dom = parser.parse(html);
        const p = dom.querySelector('p');

        assert.strictEqual(p.children.length, 1);
        assert.strictEqual(p.children[0].type, 'text');
        assert.strictEqual(p.children[0].content, 'Hello World');
    });

    await t.test('handles void elements', () => {
        const html = '<div><img src="test.jpg"><br><input type="text"></div>';
        const dom = parser.parse(html);
        const div = dom.querySelector('div');

        // Should have 3 void elements (no closing tags)
        const img = dom.querySelector('img');
        const br = dom.querySelector('br');
        const input = dom.querySelector('input');

        assert.ok(img);
        assert.ok(br);
        assert.ok(input);
        assert.strictEqual(img.getAttribute('src'), 'test.jpg');
    });

    await t.test('handles comments', () => {
        const html = '<div><!-- This is a comment --></div>';
        const dom = parser.parse(html);
        const div = dom.querySelector('div');

        assert.strictEqual(div.children[0].type, 'comment');
        assert.strictEqual(div.children[0].content, ' This is a comment ');
    });
});

test('SimpleHtmlParser - Whitespace handling', async(t) => {
    const parser = new SimpleHtmlParser();

    await t.test('preserves whitespace', () => {
        const html = `<div>
    <p>Text</p>
</div>`;
        const dom = parser.parse(html);
        const output = dom.toHtml();

        assert.strictEqual(output, html);
    });

    await t.test('preserves indentation', () => {
        const html = `<table>
    <tr>
        <td>Cell</td>
    </tr>
</table>`;
        const dom = parser.parse(html);
        const output = dom.toHtml();

        assert.strictEqual(output, html);
    });
});

test('SimpleHtmlParser - Complex HTML', async(t) => {
    const parser = new SimpleHtmlParser();

    await t.test('parses complex nested structure', () => {
        const html = `<div class="wrapper">
    <header id="header">
        <nav>
            <ul>
                <li><a href="/">Home</a></li>
                <li><a href="/about">About</a></li>
            </ul>
        </nav>
    </header>
    <main>
        <article>
            <h1>Title</h1>
            <p>Content</p>
        </article>
    </main>
</div>`;
        const dom = parser.parse(html);

        assert.ok(dom.querySelector('.wrapper'));
        assert.ok(dom.querySelector('#header'));
        assert.ok(dom.querySelector('nav'));
        assert.ok(dom.querySelector('ul'));

        const links = dom.querySelectorAll('a');
        assert.strictEqual(links.length, 2);
        assert.strictEqual(links[0].getAttribute('href'), '/');
        assert.strictEqual(links[1].getAttribute('href'), '/about');
    });

    await t.test('handles malformed HTML gracefully', () => {
        const html = '<div><p>Unclosed paragraph</div>';
        const dom = parser.parse(html);

        // Should still parse without throwing
        assert.ok(dom.querySelector('div'));
        assert.ok(dom.querySelector('p'));
    });
});

test('SimpleHtmlParser - Style tags', async(t) => {
    const parser = new SimpleHtmlParser();

    await t.test('parses style tags as CSS', () => {
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

        const rules = style.cssFindRules('.card');
        assert.strictEqual(rules.length, 1);
        assert.strictEqual(rules[0].cssDeclarations.background, 'white');
    });
});

test('SimpleHtmlParser - toHtml output', async(t) => {
    const parser = new SimpleHtmlParser();

    await t.test('reconstructs original HTML', () => {
        const html = '<div id="app"><p class="text">Hello</p></div>';
        const dom = parser.parse(html);
        const output = dom.toHtml();

        assert.strictEqual(output, html);
    });

    await t.test('handles comments in output', () => {
        const html = '<!-- Comment --><div>Content</div>';
        const dom = parser.parse(html);

        const withoutComments = dom.toHtml(false);
        const withComments = dom.toHtml(true);

        assert.ok(!withoutComments.includes('<!--'));
        assert.ok(withComments.includes('<!--'));
    });
});

test('SimpleHtmlParser - Iterator', async(t) => {
    const parser = new SimpleHtmlParser();

    await t.test('iterator works correctly on parsed HTML', () => {
        const html = '<div><p>Text</p><span>More</span></div>';
        const dom = parser.parse(html);

        const nodes = [];
        for (const node of dom) {
            nodes.push(node);
            if (nodes.length > 50) break; // Safety limit
        }

        const seen = new Set();
        for (const node of nodes) {
            assert.ok(!seen.has(node), 'No duplicate nodes in iterator');
            seen.add(node);
        }

        assert.ok(nodes.length > 0, 'Should iterate through nodes');
    });

    await t.test('iterator works correctly with nested structures', () => {
        const html = '<div><p><span>Deep</span></p></div>';
        const dom = parser.parse(html);

        const nodes = [];
        for (const node of dom) {
            nodes.push(node);
            if (nodes.length > 50) break; // Safety limit
        }

        const seen = new Set();
        for (const node of nodes) {
            assert.ok(!seen.has(node), 'No duplicate nodes in nested structure');
            seen.add(node);
        }
    });

    await t.test('iterator works correctly with tables', () => {
        const html = '<table><tr><td>Cell</td></tr></table>';
        const dom = parser.parse(html);

        const nodes = [];
        for (const node of dom) {
            nodes.push(node);
            if (nodes.length > 50) break; // Safety limit
        }

        const seen = new Set();
        for (const node of nodes) {
            assert.ok(!seen.has(node), 'No duplicate nodes in table structure');
            seen.add(node);
        }
    });
});
