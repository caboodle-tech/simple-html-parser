import assert from 'node:assert';
import { Node, SimpleHtmlParser } from '../src/simple-html-parser.js';
import { test } from 'node:test';

test('Node - innerHTML / innerText properties', async (t) => {
    await t.test('innerHTML getter matches innerHtml(false) for an element', () => {
        const parser = new SimpleHtmlParser();
        const dom = parser.parse('<div id="a"><span>x</span></div>');
        const div = dom.querySelector('#a');
        assert.strictEqual(div.innerHTML, div.innerHtml(false));
        assert.strictEqual(div.innerHTML, '<span>x</span>');
    });

    await t.test('innerHTML setter replaces children and detaches old nodes', () => {
        const parser = new SimpleHtmlParser();
        const dom = parser.parse('<div id="a"><em>old</em></div>');
        const div = dom.querySelector('#a');
        const oldEm = div.querySelector('em');
        div.innerHTML = '<p>new</p>';
        assert.strictEqual(oldEm.parent, null);
        assert.strictEqual(div.querySelector('p').innerHTML, 'new');
        assert.ok(dom.toHtml().includes('<p>new</p>'));
    });

    await t.test('innerHTML setter keeps tag-close sibling in parent child list', () => {
        const parser = new SimpleHtmlParser();
        const dom = parser.parse('<div id="a">x</div>');
        const div = dom.querySelector('#a');
        const closeBefore = div.parent.children.filter((c) => {
            return c.type === 'tag-close' && c.name === 'div';
        }).length;
        div.innerHTML = '<span>y</span>';
        const closeAfter = div.parent.children.filter((c) => {
            return c.type === 'tag-close' && c.name === 'div';
        }).length;
        assert.strictEqual(closeBefore, 1);
        assert.strictEqual(closeAfter, 1);
    });

    await t.test('innerHTML on matching tag-close redirects to opening tag', () => {
        const parser = new SimpleHtmlParser();
        const dom = parser.parse('<div id="a">in</div>');
        const div = dom.querySelector('#a');
        const close = div.parent.children.find((c) => {
            return c.type === 'tag-close' && c.name === 'div';
        });
        close.innerHTML = '<b>z</b>';
        assert.strictEqual(div.innerHTML, '<b>z</b>');
    });

    await t.test('innerHTML setter is no-op on void elements', () => {
        const parser = new SimpleHtmlParser();
        const dom = parser.parse('<div><img id="i" src="a.png"></div>');
        const img = dom.querySelector('#i');
        img.innerHTML = '<p>ignored</p>';
        assert.strictEqual(img.children.length, 0);
    });

    await t.test('innerText plain text updates a single existing text node in place', () => {
        const parser = new SimpleHtmlParser();
        const dom = parser.parse('<div id="a">hello</div>');
        const div = dom.querySelector('#a');
        const before = div.children[0];
        div.innerText = 'world';
        assert.strictEqual(div.children[0], before);
        assert.strictEqual(before.content, 'world');
        assert.strictEqual(div.children.length, 1);
    });

    await t.test('innerText replaces multiple children with one text node when plain', () => {
        const parser = new SimpleHtmlParser();
        const dom = parser.parse('<div id="a"><span>a</span><span>b</span></div>');
        const div = dom.querySelector('#a');
        div.innerText = 'only text';
        assert.strictEqual(div.children.length, 1);
        assert.strictEqual(div.children[0].type, 'text');
        assert.strictEqual(div.children[0].content, 'only text');
    });

    await t.test('innerText delegates to innerHTML when string looks like markup', () => {
        const parser = new SimpleHtmlParser();
        const dom = parser.parse('<div id="a">x</div>');
        const div = dom.querySelector('#a');
        div.innerText = '<p class="t">hi</p>';
        assert.strictEqual(div.querySelector('p.t').innerHTML, 'hi');
    });

    await t.test('innerText delegates for <!-- comment --> style hints', () => {
        const parser = new SimpleHtmlParser();
        const dom = parser.parse('<div id="a"></div>');
        const div = dom.querySelector('#a');
        div.innerText = '<!--c--><span>s</span>';
        assert.ok(div.querySelector('span'));
    });

    await t.test('innerText does not delegate for "a < b" style plain text', () => {
        const parser = new SimpleHtmlParser();
        const dom = parser.parse('<div id="a">z</div>');
        const div = dom.querySelector('#a');
        div.innerText = 'a < b';
        assert.strictEqual(div.children.length, 1);
        assert.strictEqual(div.children[0].type, 'text');
        assert.strictEqual(div.children[0].content, 'a < b');
    });

    await t.test('innerText does not delegate for less-than number', () => {
        const parser = new SimpleHtmlParser();
        const dom = parser.parse('<div id="a"></div>');
        const div = dom.querySelector('#a');
        div.innerText = 'x <3 y';
        assert.strictEqual(div.innerText, 'x <3 y');
    });

    await t.test('innerHTML on style uses parseCss and round-trips in toHtml', () => {
        const parser = new SimpleHtmlParser();
        const dom = parser.parse('<style id="s">.a { color: red; }</style>');
        const style = dom.querySelector('#s');
        style.innerHTML = '.b { margin: 0; }';
        const html = dom.toHtml();
        assert.ok(html.includes('.b'));
        assert.ok(html.includes('margin'));
    });

    await t.test('innerHTML setter throws without parser on root', () => {
        const parser = new SimpleHtmlParser();
        const dom = parser.parse('<div></div>');
        const div = dom.querySelector('div');
        delete dom.parser;
        assert.throws(() => {
            div.innerHTML = '<p>n</p>';
        }, /Parser not found/);
    });

    await t.test('innerHTML throws on root assignment', () => {
        const parser = new SimpleHtmlParser();
        const dom = parser.parse('<div></div>');
        assert.throws(() => {
            dom.innerHTML = '<p>x</p>';
        }, /root/);
    });

    await t.test('innerText getter skips style subtree', () => {
        const parser = new SimpleHtmlParser();
        const dom = parser.parse('<div><style>.x{}</style><span>ok</span></div>');
        const div = dom.querySelector('div');
        assert.strictEqual(div.innerText.trim(), 'ok');
    });

    await t.test('parseCss returns css-root with children', () => {
        const parser = new SimpleHtmlParser();
        const root = parser.parseCss('body { color: blue; }');
        assert.strictEqual(root.type, 'css-root');
        assert.ok(root.children.length >= 1);
    });
});
