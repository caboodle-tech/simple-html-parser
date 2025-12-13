import assert from 'node:assert';
import { Node, SimpleHtmlParser } from '../src/simple-html-parser.js';
import { test } from 'node:test';

test('Node - insertBefore', async(t) => {
    const parser = new SimpleHtmlParser();

    await t.test('moves node before target', () => {
        const html = `<table>
    <tr id="A"><td>A</td></tr>
    <tr id="B"><td>B</td></tr>
</table>`;
        const dom = parser.parse(html);
        const a = dom.querySelector('#A');
        const b = dom.querySelector('#B');

        a.insertBefore(b);

        const output = dom.toHtml();
        const aIndex = output.indexOf('id="A"');
        const bIndex = output.indexOf('id="B"');

        assert.ok(bIndex < aIndex, 'B should come before A');
        assert.strictEqual((output.match(/id="B"/g) || []).length, 1, 'B should appear only once');
    });

    await t.test('preserves whitespace when moving', () => {
        const html = `<div>
    <p id="A">A</p>
    <p id="B">B</p>
</div>`;
        const dom = parser.parse(html);
        const a = dom.querySelector('#A');
        const b = dom.querySelector('#B');

        a.insertBefore(b);

        const output = dom.toHtml();
        assert.ok(output.includes('\n    <p id="B">'), 'Should preserve indentation');
    });

    await t.test('works with multiple nodes', () => {
        const html = '<div><span id="A"></span><span id="B"></span><span id="C"></span></div>';
        const dom = parser.parse(html);
        const a = dom.querySelector('#A');
        const b = dom.querySelector('#B');
        const c = dom.querySelector('#C');

        a.insertBefore(b, c);

        const div = dom.querySelector('div');
        const spans = div.querySelectorAll('span');

        assert.strictEqual(spans[0].getAttribute('id'), 'B');
        assert.strictEqual(spans[1].getAttribute('id'), 'C');
        assert.strictEqual(spans[2].getAttribute('id'), 'A');
    });

    await t.test('throws error when node has no parent', () => {
        const parser = new SimpleHtmlParser();
        const orphan = parser.parse('<div></div>').querySelector('div');
        orphan.parent = null;

        assert.throws(() => {
            orphan.insertBefore(parser.parse('<p></p>').querySelector('p'));
        }, /no parent/);
    });
});

test('Node - insertAfter', async(t) => {
    const parser = new SimpleHtmlParser();

    await t.test('moves node after target', () => {
        const html = `<table>
    <tr id="A"><td>A</td></tr>
    <tr id="B"><td>B</td></tr>
</table>`;
        const dom = parser.parse(html);
        const a = dom.querySelector('#A');
        const b = dom.querySelector('#B');

        b.insertAfter(a);  // Insert A after B

        const output = dom.toHtml();
        const aIndex = output.indexOf('id="A"');
        const bIndex = output.indexOf('id="B"');

        assert.ok(bIndex < aIndex, 'B should come before A');
        assert.strictEqual((output.match(/id="A"/g) || []).length, 1, 'A should appear only once');
    });

    await t.test('works with void elements', () => {
        const html = '<div><img id="img1"><p id="p1">Text</p></div>';
        const dom = parser.parse(html);
        const img = dom.querySelector('#img1');
        const p = dom.querySelector('#p1');

        img.insertAfter(p);

        const div = dom.querySelector('div');
        const firstChild = div.children.find((c) => { return c.type === 'tag-open'; });

        assert.strictEqual(firstChild.getAttribute('id'), 'img1');
    });

    await t.test('preserves whitespace when moving', () => {
        const html = `<div>
    <p id="A">A</p>
    <p id="B">B</p>
</div>`;
        const dom = parser.parse(html);
        const a = dom.querySelector('#A');
        const b = dom.querySelector('#B');

        a.insertAfter(b);

        const output = dom.toHtml();
        assert.ok(output.includes('\n    <p id="A">'), 'Should preserve indentation');
    });
});

test('Node - replaceWith', async(t) => {
    const parser = new SimpleHtmlParser();

    await t.test('replaces node with another', () => {
        const html = `<div>
    <p id="old">Old</p>
    <p id="new">New</p>
</div>`;
        const dom = parser.parse(html);
        const oldNode = dom.querySelector('#old');
        const newNode = dom.querySelector('#new');

        oldNode.replaceWith(newNode);

        const output = dom.toHtml();
        assert.ok(!output.includes('id="old"'), 'Old node should be gone');
        assert.strictEqual((output.match(/id="new"/g) || []).length, 1, 'New node should appear once');
    });

    await t.test('replaces parent with child (edge case)', () => {
        const html = `<div id="outer">
    <div id="middle">
        <div id="inner"><p>Keep me!</p></div>
    </div>
</div>`;
        const dom = parser.parse(html);
        const outer = dom.querySelector('#outer');
        const inner = dom.querySelector('#inner');

        outer.replaceWith(inner);

        const output = dom.toHtml();
        assert.ok(!output.includes('id="outer"'), 'Outer should be gone');
        assert.ok(!output.includes('id="middle"'), 'Middle should be gone');
        assert.ok(output.includes('id="inner"'), 'Inner should remain');
        assert.ok(output.includes('Keep me!'), 'Inner content should remain');
    });

    await t.test('handles replacing with multiple nodes', () => {
        const html = '<div><p id="old">Old</p></div>';
        const dom = parser.parse(html);
        const oldNode = dom.querySelector('#old');

        const new1 = parser.parse('<span id="new1">New1</span>').querySelector('#new1');
        const new2 = parser.parse('<span id="new2">New2</span>').querySelector('#new2');

        oldNode.replaceWith(new1, new2);

        const output = dom.toHtml();
        assert.ok(!output.includes('id="old"'));
        assert.ok(output.includes('id="new1"'));
        assert.ok(output.includes('id="new2"'));
    });

    await t.test('removes both opening and closing tags', () => {
        const html = '<div><p id="remove">Content</p></div>';
        const dom = parser.parse(html);
        const p = dom.querySelector('#remove');
        const newNode = parser.parse('<span>New</span>').querySelector('span');

        p.replaceWith(newNode);

        const div = dom.querySelector('div');
        const pTags = div.children.filter((c) => { return c.name === 'p'; });

        assert.strictEqual(pTags.length, 0, 'No <p> tags should remain');
    });
});

test('Node - remove', async(t) => {
    const parser = new SimpleHtmlParser();

    await t.test('removes node from tree', () => {
        const html = '<div><p id="remove">Text</p><span>Keep</span></div>';
        const dom = parser.parse(html);
        const p = dom.querySelector('#remove');

        p.remove();

        const output = dom.toHtml();
        assert.ok(!output.includes('id="remove"'));
        assert.ok(output.includes('Keep'));
    });

    await t.test('removes both opening and closing tags', () => {
        const html = '<div><p>Remove me</p></div>';
        const dom = parser.parse(html);
        const p = dom.querySelector('p');

        p.remove();

        const div = dom.querySelector('div');
        const pTags = div.children.filter((c) => { return c.name === 'p'; });

        assert.strictEqual(pTags.length, 0);
    });

    await t.test('clears parent reference', () => {
        const html = '<div><p id="test">Text</p></div>';
        const dom = parser.parse(html);
        const p = dom.querySelector('#test');

        assert.ok(p.parent);
        p.remove();
        assert.strictEqual(p.parent, null);
    });
});

test('Node - Complex manipulation scenarios', async(t) => {
    const parser = new SimpleHtmlParser();

    await t.test('chain multiple operations', () => {
        const html = `<div>
    <p id="A">A</p>
    <p id="B">B</p>
    <p id="C">C</p>
</div>`;
        const dom = parser.parse(html);
        const a = dom.querySelector('#A');
        const b = dom.querySelector('#B');
        const c = dom.querySelector('#C');

        // Move B before A, then move C after B
        a.insertBefore(b);
        b.insertAfter(c);

        const output = dom.toHtml();
        const bIndex = output.indexOf('id="B"');
        const cIndex = output.indexOf('id="C"');
        const aIndex = output.indexOf('id="A"');

        assert.ok(bIndex < cIndex, 'B before C');
        assert.ok(cIndex < aIndex, 'C before A');
    });

    await t.test('move elements between different parents', () => {
        const html = `<div id="parent1"><p id="child">Child</p></div>
<div id="parent2"><span id="sibling">Sibling</span></div>`;
        const dom = parser.parse(html);
        const child = dom.querySelector('#child');
        const sibling = dom.querySelector('#sibling');

        // Move child to parent2 by inserting after sibling
        sibling.insertAfter(child);

        const parent1 = dom.querySelector('#parent1');
        const parent2 = dom.querySelector('#parent2');

        assert.strictEqual(parent1.querySelectorAll('p').length, 0);
        assert.strictEqual(parent2.querySelectorAll('p').length, 1);
    });
});

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
});
