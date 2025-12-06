# Simple HTML Parser

A lightweight, DOM-like HTML and CSS parser for Node.js that creates a simple tree structure (Simple Object Model - SOM) for easy manipulation and serialization back to HTML/CSS strings. **21kb minified, zero dependencies**.

## Features

- **HTML Parsing**: Parse HTML into a tree structure with proper handling of nested elements
- **CSS Parsing**: Parse inline `<style>` tags with support for modern CSS features
- **DOM Manipulation**: Insert, move, replace, and remove nodes
- **Query Selectors**: Find elements using CSS-like selectors
- **Preserves Formatting**: Maintains whitespace and indentation when manipulating nodes
- **No Dependencies**: Pure JavaScript implementation

## Installation

Add to your project via pnpm or npm:

```bash
pnpm install simple-html-parser
# or
npm install simple-html-parser
```

Or include manually by downloading the minified ESM `dist/simple-html-parser.min.js` file.

## Quick Start

```javascript
import { SimpleHtmlParser } from 'simple-html-parser';

const parser = new SimpleHtmlParser();
const dom = parser.parse('<div id="app"><h1>Hello World</h1></div>');

// Query elements
const app = dom.querySelector('#app');
const heading = dom.querySelector('h1');

// Manipulate
heading.setAttribute('class', 'title');

// Output
console.log(dom.toHtml());
// <div id="app"><h1 class="title">Hello World</h1></div>
```

## API Reference

### SimpleHtmlParser

#### `parse(html: string): Node`

Parses an HTML string into a SOM tree structure.

```javascript
const parser = new SimpleHtmlParser();
const dom = parser.parse('<div>Hello</div>');
```

#### `version(): string`

Returns the parser version.

### Node

The core building block of the SOM tree. Every element, text node, and comment is a `Node`.

#### Properties

- `type`: `'root' | 'tag-open' | 'tag-close' | 'text' | 'comment'`
- `name`: Tag name (for element nodes)
- `attributes`: Object containing element attributes
- `children`: Array of child nodes
- `parent`: Reference to parent node
- `content`: Text content (for text/comment nodes)

#### Querying Methods

##### `querySelector(selector: string): Node | null`

Find the first element matching a CSS selector.

```javascript
const div = dom.querySelector('div');
const byId = dom.querySelector('#myId');
const byClass = dom.querySelector('.myClass');
const complex = dom.querySelector('div.container > p');
```

Supported selectors:
- Tag names: `div`, `p`, `span`
- IDs: `#myId`
- Classes: `.myClass`, `.class1.class2`
- Attributes: `[data-id]`, `[data-id="value"]`
- Descendant: `div p` (p inside div)
- Pseudo-classes: `:not(selector)`

##### `querySelectorAll(selector: string): Node[]`

Find all elements matching a CSS selector.

```javascript
const allDivs = dom.querySelectorAll('div');
const allLinks = dom.querySelectorAll('a[href]');
```

##### `findAllByAttr(attrName: string): Node[]`

Find all nodes with a specific attribute.

```javascript
const withDataId = dom.findAllByAttr('data-id');
```

#### Manipulation Methods

##### `appendChild(...nodes: Node[]): Node[]`

Add child nodes to this node.

```javascript
const div = dom.querySelector('div');
const p = new Node('tag-open', 'p', {}, div);
div.appendChild(p);
```

##### `insertBefore(...nodes: Node[]): Node`

Insert nodes before this node (outside the element).

**Note:** `target.insertBefore(node)` inserts `node` before `target`.

```javascript
const b = dom.querySelector('#B');
const a = dom.querySelector('#A');
a.insertBefore(b); // Inserts B before A
```

##### `insertAfter(...nodes: Node[]): Node`

Insert nodes after this node (outside the element).

**Note:** `target.insertAfter(node)` inserts `node` after `target`.

```javascript
const a = dom.querySelector('#A');
const b = dom.querySelector('#B');
b.insertAfter(a); // Inserts A after B
```

##### `replaceWith(...nodes: Node[]): Node`

Replace this node with other nodes.

```javascript
const old = dom.querySelector('#old');
const newNode = dom.querySelector('#new');
old.replaceWith(newNode); // Removes old, replaces with new
```

##### `remove(): Node`

Remove this node from the tree. Automatically removes matching closing tags.

```javascript
const div = dom.querySelector('div');
div.remove();
```

#### Attribute Methods

##### `getAttribute(name: string): string | undefined`

Get an attribute value.

```javascript
const href = link.getAttribute('href');
```

##### `setAttribute(name: string, value: string): void`

Set an attribute value.

```javascript
div.setAttribute('class', 'container');
```

##### `removeAttribute(name: string): void`

Remove an attribute.

```javascript
div.removeAttribute('class');
```

##### `updateAttribute(name: string, value: string, separator?: string): void`

Append to an attribute value.

```javascript
div.updateAttribute('class', 'active'); // class="container active"
```

#### CSS Methods

CSS methods are available when parsing `<style>` tags.

##### `cssGetRulesBySelector(selector: string, exact?: boolean): Node[]`

Find CSS rules matching a selector.

```javascript
const cardRules = dom.cssGetRulesBySelector('.card');
```

##### `cssGetVariable(name: string): string | null`

Get a CSS custom property value.

```javascript
const primary = dom.cssGetVariable('--primary-color');
```

##### `cssGetAllSelectors(): string[]`

Get all unique CSS selectors.

```javascript
const selectors = dom.cssGetAllSelectors();
// ['.card', '#app', 'div.container', ...]
```

#### Output Methods

##### `toHtml(showComments?: boolean): string`

Convert the node tree back to an HTML string.

```javascript
const html = dom.toHtml();
const htmlWithComments = dom.toHtml(true);
```

##### `toString(): string`

Alias for `toHtml(true)`.

#### Iteration

Nodes are iterable, allowing depth-first traversal:

```javascript
for (const node of dom) {
    if (node.type === 'tag-open') {
        console.log(node.name);
    }
}
```

## Advanced Usage

### Moving Elements

```javascript
const table = dom.querySelector('table');
const rowA = dom.querySelector('#rowA');
const rowB = dom.querySelector('#rowB');

// Swap rows - insert B before A
rowA.insertBefore(rowB); // B now comes before A
```

### Creating New Elements

```javascript
const div = new Node('tag-open', 'div', { class: 'new' });
const text = new Node('text');
text.content = 'Hello';
div.appendChild(text);

const parent = dom.querySelector('#parent');
parent.appendChild(div);
```

### CSS Manipulation

```javascript
const style = dom.querySelector('style');
const variables = style.cssGetVariables();
console.log(variables);
// [{ name: '--primary', value: '#007bff', scope: ':root', rule: Node }]

const rules = style.cssGetRulesBySelector('.card');
rules.forEach(rule => {
    console.log(rule.cssDeclarations);
    // { 'background': 'white', 'padding': '1rem' }
});
```

### Special Tag Handling

The parser treats certain tags specially:

- **Void elements** (`img`, `br`, `hr`, `input`, etc.): No closing tag created
- **Style tags**: Contents parsed as CSS
- **Script tags**: Can be configured via `specialTags` parameter

```javascript
const parser = new SimpleHtmlParser(['script', 'custom-tag']);
```

## Node Structure

The parser creates a tree where:

- **Opening and closing tags are siblings** in the parent's children array
- **Element content** is in the opening tag's `children` array
- **Text nodes** (including whitespace) are preserved

Example:
```html
<div>
    <p>Hello</p>
</div>
```

Becomes:
```
root
└─ <div>
   ├─ text "\n    "
   ├─ <p>
   │  └─ text "Hello"
   ├─ </p>
   ├─ text "\n"
   └─ </div>
```

## Performance Considerations

- Regex patterns are extracted to module-level constants for reuse
- Whitespace-only text nodes are only checked during manipulation, not parsing
- Methods use private helpers to avoid duplication

## License

Common Clause with MIT

## Contributing

Contributions welcome! Please ensure all tests pass and add tests for new features.

## Author

Christopher Keers - [caboodle-tech](https://github.com/caboodle-tech)