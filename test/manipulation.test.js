import { test } from 'node:test';
import assert from 'node:assert';
import { SimpleHtmlParser } from '../src/simple-html-parser.js';

test('Node - insertBefore', async (t) => {
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

test('Node - insertAfter', async (t) => {
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
        const firstChild = div.children.find(c => c.type === 'tag-open');
        
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

test('Node - replaceWith', async (t) => {
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
        const pTags = div.children.filter(c => c.name === 'p');
        
        assert.strictEqual(pTags.length, 0, 'No <p> tags should remain');
    });
});

test('Node - remove', async (t) => {
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
        const pTags = div.children.filter(c => c.name === 'p');
        
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

test('Node - Complex manipulation scenarios', async (t) => {
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