import assert from 'node:assert';
import { Node, SimpleHtmlParser } from '../src/simple-html-parser.js';
import { test } from 'node:test';

test('Node - createNode and auto-closing tags', async(t) => {
    const parser = new SimpleHtmlParser();

    await t.test('createNode creates element with text content', () => {
        const dom = parser.parse('<div id="container"></div>');
        const container = dom.querySelector('#container');

        const p = container.createNode('p', { class: 'text' }, 'Hello World');
        container.appendChild(p);

        const output = dom.toHtml();
        assert.ok(output.includes('<p class="text">Hello World</p>'));
    });

    await t.test('createNode with appendChild auto-creates closing tag', () => {
        const dom = parser.parse('<div id="container"></div>');
        const container = dom.querySelector('#container');

        const div = container.createNode('div', { class: 'box' }, 'Content');
        container.appendChild(div);

        // Check that both opening and closing tags exist
        const output = dom.toHtml();
        assert.ok(output.includes('<div class="box">Content</div>'));

        // Verify in the tree structure
        const openTags = container.children.filter((c) => { return c.type === 'tag-open' && c.name === 'div'; });
        const closeTags = container.children.filter((c) => { return c.type === 'tag-close' && c.name === 'div'; });

        assert.strictEqual(openTags.length, 1, 'Should have one opening div tag');
        assert.strictEqual(closeTags.length, 1, 'Should have one closing div tag');
    });

    await t.test('createNode with void element does not create closing tag', () => {
        const dom = parser.parse('<div id="container"></div>');
        const container = dom.querySelector('#container');

        const img = container.createNode('img', { src: 'test.jpg', alt: 'Test' });
        container.appendChild(img);

        // Should only have opening tag, no closing tag
        const closeTags = container.children.filter((c) => { return c.type === 'tag-close' && c.name === 'img'; });
        assert.strictEqual(closeTags.length, 0, 'Void elements should not have closing tags');

        const output = dom.toHtml();
        assert.ok(output.includes('<img src="test.jpg" alt="Test">'));
        assert.ok(!output.includes('</img>'));
    });

    await t.test('createNode with array of child nodes', () => {
        const dom = parser.parse('<div id="container"></div>');
        const container = dom.querySelector('#container');

        const p1 = container.createNode('p', {}, 'First');
        const p2 = container.createNode('p', {}, 'Second');
        const div = container.createNode('div', { class: 'wrapper' }, [p1, p2]);

        container.appendChild(div);

        const output = dom.toHtml();
        assert.ok(output.includes('<div class="wrapper">'));
        assert.ok(output.includes('<p>First</p>'));
        assert.ok(output.includes('<p>Second</p>'));
        assert.ok(output.includes('</div>'));
    });

    await t.test('createNode with single child node', () => {
        const dom = parser.parse('<div id="container"></div>');
        const container = dom.querySelector('#container');

        const span = container.createNode('span', {}, 'Inner');
        const div = container.createNode('div', { class: 'outer' }, span);

        container.appendChild(div);

        const output = dom.toHtml();
        assert.ok(output.includes('<div class="outer"><span>Inner</span></div>'));
    });

    await t.test('createNode with empty content', () => {
        const dom = parser.parse('<div id="container"></div>');
        const container = dom.querySelector('#container');

        const div = container.createNode('div', { class: 'empty' });
        container.appendChild(div);

        const output = dom.toHtml();
        assert.ok(output.includes('<div class="empty"></div>'));
    });

    await t.test('appendChild does not duplicate closing tag if manually provided', () => {
        const dom = parser.parse('<div id="container"></div>');
        const container = dom.querySelector('#container');

        const openTag = new Node('tag-open', 'p', { id: 'test' });
        const textNode = new Node('text');
        textNode.content = 'Content';
        openTag.appendChild(textNode);

        const closeTag = new Node('tag-close', 'p');

        // Manually append both tags
        container.appendChild(openTag, closeTag);

        // Should only have one closing tag (the one we provided)
        const closeTags = container.children.filter((c) => { return c.type === 'tag-close' && c.name === 'p'; });
        assert.strictEqual(closeTags.length, 1, 'Should not create duplicate closing tag');

        const output = dom.toHtml();
        assert.strictEqual((output.match(/<\/p>/g) || []).length, 1, 'Should have exactly one closing p tag');
    });

    await t.test('createNode works with nested structure', () => {
        const dom = parser.parse('<body></body>');
        const body = dom.querySelector('body');

        const h1 = body.createNode('h1', {}, 'Title');
        const p1 = body.createNode('p', {}, 'Paragraph 1');
        const p2 = body.createNode('p', {}, 'Paragraph 2');
        const article = body.createNode('article', { class: 'post' }, [h1, p1, p2]);

        body.appendChild(article);

        const output = dom.toHtml();

        // Verify structure
        assert.ok(output.includes('<article class="post">'));
        assert.ok(output.includes('<h1>Title</h1>'));
        assert.ok(output.includes('<p>Paragraph 1</p>'));
        assert.ok(output.includes('<p>Paragraph 2</p>'));
        assert.ok(output.includes('</article>'));

        // Verify proper nesting
        const articleStart = output.indexOf('<article');
        const articleEnd = output.indexOf('</article>');
        const h1Pos = output.indexOf('<h1>');

        assert.ok(articleStart < h1Pos && h1Pos < articleEnd, 'h1 should be inside article');
    });

    await t.test('createNode works with all void elements', () => {
        const dom = parser.parse('<div id="container"></div>');
        const container = dom.querySelector('#container');

        const voidElements = ['img', 'br', 'hr', 'input', 'meta', 'link'];

        for (const tag of voidElements) {
            const element = container.createNode(tag, { id: `test-${tag}` });
            container.appendChild(element);
        }

        const output = dom.toHtml();

        // None should have closing tags
        for (const tag of voidElements) {
            assert.ok(!output.includes(`</${tag}>`), `${tag} should not have closing tag`);
        }
    });

    await t.test('createNode with complex attributes', () => {
        const dom = parser.parse('<div id="container"></div>');
        const container = dom.querySelector('#container');

        const div = container.createNode('div', {
            id: 'complex',
            class: 'class1 class2 class3',
            'data-value': '123',
            'data-name': 'test'
        }, 'Content');

        container.appendChild(div);

        const output = dom.toHtml();
        assert.ok(output.includes('id="complex"'));
        assert.ok(output.includes('class="class1 class2 class3"'));
        assert.ok(output.includes('data-value="123"'));
        assert.ok(output.includes('data-name="test"'));
    });

    await t.test('iterator works correctly after createNode and appendChild', () => {
        const dom = parser.parse('<div id="container"></div>');
        const container = dom.querySelector('#container');

        const p = container.createNode('p', { class: 'text' }, 'Hello World');
        container.appendChild(p);

        // Iterate and check for duplicates
        const nodes = [];
        for (const node of dom) {
            nodes.push(node);
            if (nodes.length > 50) break; // Safety limit
        }

        const seen = new Set();
        for (const node of nodes) {
            assert.ok(!seen.has(node), 'No duplicate nodes in iterator after createNode');
            seen.add(node);
        }

        // Verify created content appears in output
        const output = dom.toHtml();
        assert.ok(output.includes('<p class="text">Hello World</p>'), 'Created node should appear in output');
    });
});

test('Node - insertAdjacentHTML', async(t) => {
    const parser = new SimpleHtmlParser();

    await t.test('beforebegin - inserts before element', () => {
        const html = '<div id="container">Hello</div>';
        const dom = parser.parse(html);
        const container = dom.querySelector('#container');

        container.insertAdjacentHTML('beforebegin', '<p>Before</p>');

        const output = dom.toHtml();
        const beforeIndex = output.indexOf('<p>Before</p>');
        const containerIndex = output.indexOf('id="container"');

        assert.ok(beforeIndex < containerIndex, 'Before should come before container');
    });

    await t.test('afterbegin - inserts at start of children', () => {
        const html = '<div id="container">Hello</div>';
        const dom = parser.parse(html);
        const container = dom.querySelector('#container');

        container.insertAdjacentHTML('afterbegin', '<span>Start</span>');

        const output = dom.toHtml();
        assert.ok(output.includes('<div id="container"><span>Start</span>Hello</div>'));
    });

    await t.test('beforeend - inserts at end of children', () => {
        const html = '<div id="container">Hello</div>';
        const dom = parser.parse(html);
        const container = dom.querySelector('#container');

        container.insertAdjacentHTML('beforeend', '<span>End</span>');

        const output = dom.toHtml();
        assert.ok(output.includes('<div id="container">Hello<span>End</span></div>'));
    });

    await t.test('afterend - inserts after element', () => {
        const html = '<div id="container">Hello</div>';
        const dom = parser.parse(html);
        const container = dom.querySelector('#container');

        container.insertAdjacentHTML('afterend', '<p>After</p>');

        const output = dom.toHtml();
        const containerEnd = output.indexOf('</div>');
        const afterIndex = output.indexOf('<p>After</p>');

        assert.ok(afterIndex > containerEnd, 'After should come after container');
    });

    await t.test('handles multiple elements in HTML string', () => {
        const html = '<div id="container">Hello</div>';
        const dom = parser.parse(html);
        const container = dom.querySelector('#container');

        container.insertAdjacentHTML('beforeend', '<span>A</span><span>B</span>');

        const output = dom.toHtml();
        assert.ok(output.includes('<span>A</span>'));
        assert.ok(output.includes('<span>B</span>'));
        const aIndex = output.indexOf('<span>A</span>');
        const bIndex = output.indexOf('<span>B</span>');
        assert.ok(aIndex < bIndex, 'A should come before B');
    });

    await t.test('handles empty HTML string', () => {
        const html = '<div id="container">Hello</div>';
        const dom = parser.parse(html);
        const container = dom.querySelector('#container');

        container.insertAdjacentHTML('beforeend', '');

        const output = dom.toHtml();
        assert.strictEqual(output, '<div id="container">Hello</div>');
    });

    await t.test('throws error for invalid position', () => {
        const html = '<div id="container">Hello</div>';
        const dom = parser.parse(html);
        const container = dom.querySelector('#container');

        assert.throws(() => {
            container.insertAdjacentHTML('invalid', '<p>Test</p>');
        }, /Invalid position/);
    });

    await t.test('throws error for afterbegin on void element', () => {
        const html = '<div><img id="img"></div>';
        const dom = parser.parse(html);
        const img = dom.querySelector('#img');

        assert.throws(() => {
            img.insertAdjacentHTML('afterbegin', '<span>Test</span>');
        }, /afterbegin cannot be used on void elements/);
    });

    await t.test('throws error for beforeend on void element', () => {
        const html = '<div><img id="img"></div>';
        const dom = parser.parse(html);
        const img = dom.querySelector('#img');

        assert.throws(() => {
            img.insertAdjacentHTML('beforeend', '<span>Test</span>');
        }, /beforeend cannot be used on void elements/);
    });

    await t.test('throws error for beforebegin on root node', () => {
        const html = '<div>Hello</div>';
        const dom = parser.parse(html);

        assert.throws(() => {
            dom.insertAdjacentHTML('beforebegin', '<p>Test</p>');
        }, /Cannot insert beforebegin on node with no parent/);
    });

    await t.test('throws error for afterend on root node', () => {
        const html = '<div>Hello</div>';
        const dom = parser.parse(html);

        assert.throws(() => {
            dom.insertAdjacentHTML('afterend', '<p>Test</p>');
        }, /Cannot insert afterend on node with no parent/);
    });

    await t.test('works with closing tag (redirects to opening tag)', () => {
        const html = '<div id="container">Hello</div><p>Other</p>';
        const dom = parser.parse(html);
        const container = dom.querySelector('#container');
        // Find the closing tag
        const root = dom;
        const closingTag = root.children.find(child => 
            child.type === 'tag-close' && child.name === 'div'
        );

        closingTag.insertAdjacentHTML('afterend', '<span>After</span>');

        const output = dom.toHtml();
        const containerEnd = output.indexOf('</div>');
        const afterIndex = output.indexOf('<span>After</span>');
        assert.ok(afterIndex > containerEnd, 'Should insert after closing tag');
    });

    await t.test('preserves parser configuration (special tags)', () => {
        const customParser = new SimpleHtmlParser(['script', 'custom']);
        const html = '<div id="container">Hello</div>';
        const dom = customParser.parse(html);
        const container = dom.querySelector('#container');

        // Should use the same parser config
        container.insertAdjacentHTML('beforeend', '<script>alert("test")</script>');

        const output = dom.toHtml();
        assert.ok(output.includes('<script>alert("test")</script>'));
    });

    await t.test('throws error when parser not found (manually created node)', () => {
        const node = new Node('tag-open', 'div');

        assert.throws(() => {
            node.insertAdjacentHTML('beforeend', '<span>Test</span>');
        }, /Parser not found/);
    });

    await t.test('complex nested HTML insertion', () => {
        const html = '<div id="container">Hello</div>';
        const dom = parser.parse(html);
        const container = dom.querySelector('#container');

        container.insertAdjacentHTML('beforeend', '<div class="nested"><p>Nested</p></div>');

        const output = dom.toHtml();
        assert.ok(output.includes('<div class="nested">'));
        assert.ok(output.includes('<p>Nested</p>'));
        assert.ok(output.includes('</div>'));
    });

    await t.test('chaining works', () => {
        const html = '<div id="container">Hello</div>';
        const dom = parser.parse(html);
        const container = dom.querySelector('#container');

        const result = container
            .insertAdjacentHTML('afterbegin', '<span>A</span>')
            .insertAdjacentHTML('beforeend', '<span>B</span>');

        assert.strictEqual(result, container);
        const output = dom.toHtml();
        assert.ok(output.includes('<span>A</span>'));
        assert.ok(output.includes('<span>B</span>'));
    });

    await t.test('iterator works correctly after insertAdjacentHTML', () => {
        const html = '<div id="container">Hello</div>';
        const dom = parser.parse(html);
        const container = dom.querySelector('#container');

        container.insertAdjacentHTML('beforeend', '<span>New</span>');

        // Iterate and check for duplicates
        const nodes = [];
        for (const node of dom) {
            nodes.push(node);
            if (nodes.length > 50) break; // Safety limit
        }

        const seen = new Set();
        for (const node of nodes) {
            assert.ok(!seen.has(node), 'No duplicate nodes in iterator after insertAdjacentHTML');
            seen.add(node);
        }

        // Verify inserted content is in the output
        const output = dom.toHtml();
        assert.ok(output.includes('<span>New</span>'), 'Inserted content should be in output');
    });

    await t.test('iterator works correctly after multiple insertAdjacentHTML calls', () => {
        const html = '<div id="container">Hello</div>';
        const dom = parser.parse(html);
        const container = dom.querySelector('#container');

        container.insertAdjacentHTML('afterbegin', '<span>A</span>');
        container.insertAdjacentHTML('beforeend', '<span>B</span>');

        // Iterate and check for duplicates
        const nodes = [];
        for (const node of dom) {
            nodes.push(node);
            if (nodes.length > 50) break; // Safety limit
        }

        const seen = new Set();
        for (const node of nodes) {
            assert.ok(!seen.has(node), 'No duplicate nodes in iterator after multiple insertAdjacentHTML calls');
            seen.add(node);
        }
    });

    await t.test('iterator works correctly after insertAdjacentHTML with nested structures', () => {
        const html = '<div id="container">Hello</div>';
        const dom = parser.parse(html);
        const container = dom.querySelector('#container');

        container.insertAdjacentHTML('beforeend', '<div class="nested"><p>Nested</p><span>More</span></div>');

        // Iterate and check for duplicates
        const nodes = [];
        for (const node of dom) {
            nodes.push(node);
            if (nodes.length > 50) break; // Safety limit
        }

        const seen = new Set();
        for (const node of nodes) {
            assert.ok(!seen.has(node), 'No duplicate nodes in iterator after nested insertAdjacentHTML');
            seen.add(node);
        }

        // Verify nested structure is in output
        const output = dom.toHtml();
        assert.ok(output.includes('<div class="nested">'), 'Nested div should be in output');
        assert.ok(output.includes('<p>Nested</p>'), 'Nested p should be in output');
        assert.ok(output.includes('<span>More</span>'), 'Nested span should be in output');
    });

    await t.test('iterator works correctly after insertAdjacentHTML with closing tags', () => {
        const html = '<div id="container">Hello</div>';
        const dom = parser.parse(html);
        const container = dom.querySelector('#container');

        // Insert HTML that includes elements with closing tags
        container.insertAdjacentHTML('beforeend', '<p>Paragraph</p><span>Span</span>');

        // Iterate and check for duplicates
        const nodes = [];
        for (const node of dom) {
            nodes.push(node);
            if (nodes.length > 50) break; // Safety limit
        }

        const seen = new Set();
        for (const node of nodes) {
            assert.ok(!seen.has(node), 'No duplicate nodes in iterator after insertAdjacentHTML with closing tags');
            seen.add(node);
        }

        // Verify all opening and closing tags are present exactly once
        const output = dom.toHtml();
        const pOpenCount = (output.match(/<p>/g) || []).length;
        const pCloseCount = (output.match(/<\/p>/g) || []).length;
        const spanOpenCount = (output.match(/<span>/g) || []).length;
        const spanCloseCount = (output.match(/<\/span>/g) || []).length;

        assert.strictEqual(pOpenCount, 1, 'Should have exactly one opening p tag');
        assert.strictEqual(pCloseCount, 1, 'Should have exactly one closing p tag');
        assert.strictEqual(spanOpenCount, 1, 'Should have exactly one opening span tag');
        assert.strictEqual(spanCloseCount, 1, 'Should have exactly one closing span tag');
    });
});

