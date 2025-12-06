import { test } from 'node:test';
import assert from 'node:assert';
import { SimpleHtmlParser } from '../src/simple-html-parser.js';

test('Node - querySelector basics', async (t) => {
    const parser = new SimpleHtmlParser();

    await t.test('finds element by tag name', () => {
        const html = '<div><p>Text</p><span>More</span></div>';
        const dom = parser.parse(html);
        
        const p = dom.querySelector('p');
        assert.ok(p);
        assert.strictEqual(p.name, 'p');
    });

    await t.test('finds element by ID', () => {
        const html = '<div id="app"><p id="content">Text</p></div>';
        const dom = parser.parse(html);
        
        const app = dom.querySelector('#app');
        const content = dom.querySelector('#content');
        
        assert.strictEqual(app.getAttribute('id'), 'app');
        assert.strictEqual(content.getAttribute('id'), 'content');
    });

    await t.test('finds element by class', () => {
        const html = '<div class="container"><p class="text">Content</p></div>';
        const dom = parser.parse(html);
        
        const container = dom.querySelector('.container');
        const text = dom.querySelector('.text');
        
        assert.ok(container);
        assert.ok(text);
    });

    await t.test('finds element by multiple classes', () => {
        const html = '<div class="card primary active">Content</div>';
        const dom = parser.parse(html);
        
        const element = dom.querySelector('.card.primary');
        assert.ok(element);
        
        const withActive = dom.querySelector('.card.active');
        assert.ok(withActive);
    });

    await t.test('finds element by attribute', () => {
        const html = '<div><a href="/home">Home</a><a href="/about">About</a></div>';
        const dom = parser.parse(html);
        
        const withHref = dom.querySelector('[href]');
        assert.ok(withHref);
        
        const specific = dom.querySelector('[href="/about"]');
        assert.strictEqual(specific.getAttribute('href'), '/about');
    });

    await t.test('returns null when not found', () => {
        const html = '<div><p>Text</p></div>';
        const dom = parser.parse(html);
        
        const notFound = dom.querySelector('.nonexistent');
        assert.strictEqual(notFound, null);
    });
});

test('Node - querySelector complex selectors', async (t) => {
    const parser = new SimpleHtmlParser();

    await t.test('finds descendant elements', () => {
        const html = `<div class="wrapper">
    <div class="container">
        <p class="text">Deep text</p>
    </div>
</div>`;
        const dom = parser.parse(html);
        
        const deep = dom.querySelector('.wrapper .text');
        assert.ok(deep);
        assert.strictEqual(deep.getAttribute('class'), 'text');
    });

    await t.test('combines tag, class, and ID', () => {
        const html = '<div><p id="main" class="content">Text</p></div>';
        const dom = parser.parse(html);
        
        const element = dom.querySelector('p#main.content');
        assert.ok(element);
    });

    await t.test('handles :not() pseudo-class', () => {
        const html = `<div>
    <p class="normal">Normal</p>
    <p class="special">Special</p>
</div>`;
        const dom = parser.parse(html);
        
        const notSpecial = dom.querySelector('p:not(.special)');
        assert.strictEqual(notSpecial.getAttribute('class'), 'normal');
    });
});

test('Node - querySelectorAll', async (t) => {
    const parser = new SimpleHtmlParser();

    await t.test('finds all matching elements', () => {
        const html = '<div><p>One</p><p>Two</p><p>Three</p></div>';
        const dom = parser.parse(html);
        
        const paragraphs = dom.querySelectorAll('p');
        assert.strictEqual(paragraphs.length, 3);
    });

    await t.test('finds all elements with class', () => {
        const html = `<div>
    <span class="item">1</span>
    <p class="item">2</p>
    <div class="item">3</div>
</div>`;
        const dom = parser.parse(html);
        
        const items = dom.querySelectorAll('.item');
        assert.strictEqual(items.length, 3);
    });

    await t.test('returns empty array when none found', () => {
        const html = '<div><p>Text</p></div>';
        const dom = parser.parse(html);
        
        const notFound = dom.querySelectorAll('.nonexistent');
        assert.strictEqual(notFound.length, 0);
    });

    await t.test('finds nested matching elements', () => {
        const html = `<div>
    <ul>
        <li>Item 1</li>
        <li>Item 2</li>
    </ul>
    <ul>
        <li>Item 3</li>
    </ul>
</div>`;
        const dom = parser.parse(html);
        
        const items = dom.querySelectorAll('li');
        assert.strictEqual(items.length, 3);
    });
});

test('Node - findAll methods', async (t) => {
    const parser = new SimpleHtmlParser();

    await t.test('findAllByAttr', () => {
        const html = `<div>
    <a href="/home" data-id="1">Home</a>
    <a href="/about" data-id="2">About</a>
    <span data-id="3">Other</span>
</div>`;
        const dom = parser.parse(html);
        
        const withDataId = dom.findAllByAttr('data-id');
        assert.strictEqual(withDataId.length, 3);
        
        const withHref = dom.findAllByAttr('href');
        assert.strictEqual(withHref.length, 2);
    });
});

test('Node - getAttribute/setAttribute', async (t) => {
    const parser = new SimpleHtmlParser();

    await t.test('getAttribute returns attribute value', () => {
        const html = '<div id="app" class="container"></div>';
        const dom = parser.parse(html);
        const div = dom.querySelector('div');
        
        assert.strictEqual(div.getAttribute('id'), 'app');
        assert.strictEqual(div.getAttribute('class'), 'container');
    });

    await t.test('getAttribute returns undefined for missing attribute', () => {
        const html = '<div></div>';
        const dom = parser.parse(html);
        const div = dom.querySelector('div');
        
        assert.strictEqual(div.getAttribute('id'), undefined);
    });

    await t.test('setAttribute adds/modifies attributes', () => {
        const html = '<div></div>';
        const dom = parser.parse(html);
        const div = dom.querySelector('div');
        
        div.setAttribute('id', 'app');
        div.setAttribute('class', 'container');
        
        assert.strictEqual(div.getAttribute('id'), 'app');
        assert.strictEqual(div.getAttribute('class'), 'container');
        
        const output = dom.toHtml();
        assert.ok(output.includes('id="app"'));
        assert.ok(output.includes('class="container"'));
    });

    await t.test('removeAttribute removes attribute', () => {
        const html = '<div id="app" class="container"></div>';
        const dom = parser.parse(html);
        const div = dom.querySelector('div');
        
        div.removeAttribute('class');
        
        assert.strictEqual(div.getAttribute('class'), undefined);
        assert.strictEqual(div.getAttribute('id'), 'app');
    });

    await t.test('updateAttribute appends to existing value', () => {
        const html = '<div class="container"></div>';
        const dom = parser.parse(html);
        const div = dom.querySelector('div');
        
        div.updateAttribute('class', 'active');
        
        assert.strictEqual(div.getAttribute('class'), 'container active');
    });
});

test('Node - Edge cases', async (t) => {
    const parser = new SimpleHtmlParser();

    await t.test('querySelector on non-root node searches descendants', () => {
        const html = `<div id="parent">
    <div id="child1">
        <p class="text">Text 1</p>
    </div>
    <div id="child2">
        <p class="text">Text 2</p>
    </div>
</div>`;
        const dom = parser.parse(html);
        const child1 = dom.querySelector('#child1');
        
        const p = child1.querySelector('.text');
        assert.ok(p);
        assert.strictEqual(p.getAttribute('class'), 'text');
        
        // Verify it found the text within child1's subtree
        const textContent = p.children.find(c => c.type === 'text');
        assert.ok(textContent.content.includes('Text 1'));
    });

    await t.test('handles special characters in attributes', () => {
        const html = '<div data-value="hello&world" title="It\'s fine"></div>';
        const dom = parser.parse(html);
        const div = dom.querySelector('div');
        
        assert.strictEqual(div.getAttribute('data-value'), 'hello&world');
        assert.strictEqual(div.getAttribute('title'), "It's fine");
    });
});