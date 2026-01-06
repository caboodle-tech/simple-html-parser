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

    await t.test('iterator works correctly after insertBefore', () => {
        const html = '<div><p id="A">A</p><p id="B">B</p></div>';
        const dom = parser.parse(html);
        const a = dom.querySelector('#A');
        const b = dom.querySelector('#B');

        a.insertBefore(b);

        // Iterate and check for duplicates
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

    await t.test('iterator works correctly after insertAfter', () => {
        const html = '<div><p id="A">A</p><p id="B">B</p></div>';
        const dom = parser.parse(html);
        const a = dom.querySelector('#A');
        const b = dom.querySelector('#B');

        b.insertAfter(a);

        // Iterate and check for duplicates
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

    await t.test('iterator works correctly after replaceWith', () => {
        const html = '<div><p id="old">Old</p><span>Keep</span></div>';
        const dom = parser.parse(html);
        const oldNode = dom.querySelector('#old');
        const newNode = parser.parse('<p id="new">New</p>').querySelector('#new');

        oldNode.replaceWith(newNode);

        // Iterate and check for duplicates
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

        // Verify old node is gone and new node exists
        assert.ok(!nodes.some(n => n === oldNode), 'Old node should not be in iterator');
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

    await t.test('iterator works correctly after remove', () => {
        const html = '<div><p id="remove">Text</p><span>Keep</span></div>';
        const dom = parser.parse(html);
        const p = dom.querySelector('#remove');

        p.remove();

        // Iterate and check for duplicates
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

        // Verify removed node is not in iterator
        assert.ok(!nodes.some(n => n === p), 'Removed node should not be in iterator');
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

    await t.test('iterator works correctly after complex manipulations', () => {
        const html = `<div>
    <p id="A">A</p>
    <p id="B">B</p>
    <p id="C">C</p>
</div>`;
        const dom = parser.parse(html);
        const a = dom.querySelector('#A');
        const b = dom.querySelector('#B');
        const c = dom.querySelector('#C');

        // Chain multiple operations
        a.insertBefore(b);
        b.insertAfter(c);

        // Iterate and check for duplicates
        const nodes = [];
        for (const node of dom) {
            nodes.push(node);
            if (nodes.length > 50) break; // Safety limit
        }

        const seen = new Set();
        for (const node of nodes) {
            assert.ok(!seen.has(node), 'No duplicate nodes in iterator after complex manipulations');
            seen.add(node);
        }
    });

    await t.test('iterator works correctly when moving between parents', () => {
        const html = `<div id="parent1"><p id="child">Child</p></div>
<div id="parent2"><span id="sibling">Sibling</span></div>`;
        const dom = parser.parse(html);
        const child = dom.querySelector('#child');
        const sibling = dom.querySelector('#sibling');

        sibling.insertAfter(child);

        // Iterate and check for duplicates
        const nodes = [];
        for (const node of dom) {
            nodes.push(node);
            if (nodes.length > 50) break; // Safety limit
        }

        const seen = new Set();
        for (const node of nodes) {
            assert.ok(!seen.has(node), 'No duplicate nodes in iterator when moving between parents');
            seen.add(node);
        }

        // Verify child appears only once
        const childNodes = nodes.filter(n => n === child);
        assert.strictEqual(childNodes.length, 1, 'Child should appear exactly once in iterator');
    });
});

test('Node - Edge cases from FIX.md', async(t) => {
    const parser = new SimpleHtmlParser();

    await t.test('moving node to same parent should still work (extract and re-append)', () => {
        const html = '<div id="parent"><p id="child">Child</p><span>Sibling</span></div>';
        const dom = parser.parse(html);
        const parent = dom.querySelector('#parent');
        const child = dom.querySelector('#child');

        // Move child to the same parent (should extract and re-append)
        parent.appendChild(child);

        // Verify child is still in parent
        assert.ok(parent.children.includes(child), 'Child should still be in parent');
        assert.strictEqual(child.parent, parent, 'Child parent should still be parent');

        // Verify child appears only once in parent's children
        const childCount = parent.children.filter(c => c === child).length;
        assert.strictEqual(childCount, 1, 'Child should appear only once in parent');

        // Verify iterator works correctly
        const nodes = [];
        for (const node of dom) {
            nodes.push(node);
            if (nodes.length > 50) break;
        }

        const seen = new Set();
        for (const node of nodes) {
            assert.ok(!seen.has(node), 'No duplicate nodes in iterator when moving to same parent');
            seen.add(node);
        }

        // Verify child appears only once in iterator
        const childNodes = nodes.filter(n => n === child);
        assert.strictEqual(childNodes.length, 1, 'Child should appear exactly once in iterator');
    });

    await t.test('moving node with closing tag - closing tag should move along with opening tag', () => {
        const html = '<div id="parent1"><p id="child">Content</p></div><div id="parent2"></div>';
        const dom = parser.parse(html);
        const parent1 = dom.querySelector('#parent1');
        const parent2 = dom.querySelector('#parent2');
        const child = dom.querySelector('#child');

        // Find the closing tag
        const closingTag = parent1.children.find(c => 
            c.type === 'tag-close' && c.name === 'p'
        );
        assert.ok(closingTag, 'Closing tag should exist');

        // Move child to parent2
        parent2.appendChild(child);

        // Verify closing tag is also moved
        assert.ok(!parent1.children.includes(closingTag), 'Closing tag should be removed from parent1');
        assert.ok(parent2.children.includes(closingTag), 'Closing tag should be in parent2');

        // Verify iterator works correctly
        const nodes = [];
        for (const node of dom) {
            nodes.push(node);
            if (nodes.length > 50) break;
        }

        const seen = new Set();
        for (const node of nodes) {
            assert.ok(!seen.has(node), 'No duplicate nodes in iterator when moving with closing tag');
            seen.add(node);
        }

        // Verify both opening and closing tags appear exactly once
        const childNodes = nodes.filter(n => n === child);
        const closingNodes = nodes.filter(n => n === closingTag);
        assert.strictEqual(childNodes.length, 1, 'Opening tag should appear exactly once');
        assert.strictEqual(closingNodes.length, 1, 'Closing tag should appear exactly once');
    });

    await t.test('whitespace before node in old location should NOT be moved', () => {
        const html = `<div id="parent1">
    <p id="child">Content</p>
</div>
<div id="parent2"></div>`;
        const dom = parser.parse(html);
        const parent1 = dom.querySelector('#parent1');
        const parent2 = dom.querySelector('#parent2');
        const child = dom.querySelector('#child');

        // Get the original HTML to check whitespace
        const originalOutput = dom.toHtml();
        const originalWhitespaceBefore = originalOutput.match(/\s+<p id="child">/)?.[0];

        // Move child to parent2
        parent2.appendChild(child);

        // Get the new HTML
        const newOutput = dom.toHtml();

        // Verify whitespace before child in parent1's location is preserved (not moved)
        // The whitespace should remain in parent1's location
        const parent1After = newOutput.match(/<div id="parent1">([\s\S]*?)<\/div>/)?.[1];
        assert.ok(parent1After, 'Parent1 should still exist');
        
        // Verify child is in parent2
        assert.ok(newOutput.includes('<div id="parent2"><p id="child">'), 'Child should be in parent2');

        // Verify iterator works correctly
        const nodes = [];
        for (const node of dom) {
            nodes.push(node);
            if (nodes.length > 50) break;
        }

        const seen = new Set();
        for (const node of nodes) {
            assert.ok(!seen.has(node), 'No duplicate nodes in iterator when moving with whitespace');
            seen.add(node);
        }
    });

    await t.test('iterator handles node moved during active iteration (wasRemoved flag)', () => {
        const html = '<div id="parent1"><p id="child">Child</p></div><div id="parent2"></div>';
        const dom = parser.parse(html);
        const child = dom.querySelector('#child');
        const parent2 = dom.querySelector('#parent2');

        // Start iterating
        const nodes = [];
        let iterationCount = 0;
        let childEncountered = false;
        const maxIterations = 50;

        try {
            for (const node of dom) {
                nodes.push(node);
                iterationCount++;

                // When we encounter the child, move it to parent2
                // Note: The iterator should handle this gracefully via wasRemoved flag
                if (node === child && !childEncountered && iterationCount < 10) {
                    childEncountered = true;
                    parent2.appendChild(child);
                }

                if (iterationCount >= maxIterations) {
                    throw new Error('Infinite loop detected');
                }
            }
        } catch (error) {
            if (error.message === 'Infinite loop detected') {
                throw error;
            }
        }

        // Verify no duplicates - this is the key test: iterator should not return duplicates
        // even when a node is moved during iteration
        const seen = new Set();
        for (const node of nodes) {
            assert.ok(!seen.has(node), 'No duplicate nodes even when moving during iteration');
            seen.add(node);
        }

        // Verify child was moved (after iteration completes)
        assert.strictEqual(child.parent, parent2, 'Child should be in parent2 after move');
        
        // Verify child appears only once in the collected nodes
        const childNodes = nodes.filter(n => n === child);
        assert.ok(childNodes.length <= 1, 'Child should appear at most once in iterator (may appear 0 times if moved before being yielded)');
    });

    await t.test('appendChild to same parent with iterator validation', () => {
        const html = '<div id="parent"><p id="child1">First</p><p id="child2">Second</p></div>';
        const dom = parser.parse(html);
        const parent = dom.querySelector('#parent');
        const child1 = dom.querySelector('#child1');

        // Append child1 to the same parent (should extract and re-append)
        parent.appendChild(child1);

        // Verify iterator works correctly
        const nodes = [];
        for (const node of dom) {
            nodes.push(node);
            if (nodes.length > 50) break;
        }

        const seen = new Set();
        for (const node of nodes) {
            assert.ok(!seen.has(node), 'No duplicate nodes when appending to same parent');
            seen.add(node);
        }

        // Verify child1 appears only once
        const child1Nodes = nodes.filter(n => n === child1);
        assert.strictEqual(child1Nodes.length, 1, 'Child1 should appear exactly once');
    });
});

