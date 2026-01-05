/* eslint-disable max-len */
const REGEX = {
    notSelector: /:not\(([^)]+)\)/g,
    queryAttributeMatches: /\[([^\]]+)\]/g,
    queryClassMatches: /\.([a-zA-Z0-9\-_]+)/g,
    queryIdMatch: /#([a-zA-Z0-9\-_]+)/,
    querySelectorParts: /([a-zA-Z0-9\-_]+)?(\#[a-zA-Z0-9\-_]+)?(\.[a-zA-Z0-9\-_]+)*(\[[^\]]+\])*/g,
    queryTagMatch: /^[a-zA-Z0-9\-_]+/,
    rawValue: /^["'](.*)["']$/,
    whitespace: /\s+/
};

const VOID_ELEMS = ['img', 'br', 'hr', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'param', 'source', 'track', 'wbr'];

/**
 * Represents a DOM node in the parsed HTML tree.
 */
class Node {

    /**
     * @type {Object.<string, string>} Attributes of this node
     */
    attributes = {};

    /**
     * @type {Node[]} Child nodes
     */
    children = [];

    /**
     * @type {string} Text content for text nodes
     */
    content = '';

    /**
     * @type {string} Tag name or type identifier
     */
    name = '';

    /**
     * @type {Node|null} Parent node reference
     */
    parent = null;

    /**
     * @type {string} Node type or CSS Node type:
     * - 'comment', 'text', 'root', 'tag-close', 'tag-open'
     * - 'css-rule', 'css-at-rule', 'css-root'
     */
    type = '';

    /**
     * Creates a new Node instance.
     * @param {string} type - The type of node ('comment', 'text', 'root', 'tag-close', 'tag-open')
     * @param {string} [name=''] - The tag name for element nodes
     * @param {Object.<string, string>} [attributes={}] - Node attributes
     * @param {Node|null} [parent=null] - Parent node
     */
    constructor(type, name = '', attributes = {}, parent = null) {
        this.type = type;
        this.name = name;
        this.attributes = attributes;
        this.parent = parent;
    }

    /**
     * Makes Node objects directly iterable with for...of loops. Provides a robust
     * depth-first traversal that correctly handles:
     * - Nodes being removed during iteration
     * - Skipping a node's children using node.skipChildren()
     * - DOM tree modifications during traversal
     *
     * Uses a stateful approach that determines the next node dynamically based
     * on the current state of the DOM tree.
     *
     * @returns {Iterator} A DOM traversal iterator
     */
    [Symbol.iterator]() {
        // Start with this node (or for root nodes, start with first child)
        let currentNode = this.type === 'root' && this.children.length > 0 ?
            this.children[0] :
            this;

        // Track if we've started the traversal yet
        let started = false;

        // Flag to skip children for a node
        let skipChildrenForCurrentNode = false;

        // Flag to track if the current node was removed
        let wasRemoved = false;

        // Define helper functions using arrow functions
        const getNextNodeInAncestry = (node) => {
        // If we've reached the root or a null node, traversal is complete
            if (!node || (node.type === 'root' && node.parent === null)) {
                return null;
            }

            // If this node has a next sibling, go to it
            if (node.parent) {
                const siblings = node.parent.children;
                const currentIndex = siblings.indexOf(node);

                // If there's a next sibling, go to it
                if (currentIndex < siblings.length - 1) {
                    return siblings[currentIndex + 1];
                }
            }

            // Otherwise, go up to parent and continue looking
            return getNextNodeInAncestry(node.parent);
        };

        const getNextNode = (node) => {
            // If the node was removed, we need special handling
            if (wasRemoved) {
                /**
                 * If the node was removed, its siblings have shifted We should
                 * get what would have been the next sibling.
                 */
                if (node.parent) {
                    /**
                     * Look at where the node was in its parent. If there are more
                     * siblings after where it was, get the next one. If not, go up
                     * to the parent's next sibling.
                     */
                    return getNextNodeInAncestry(node.parent);
                }
                return null;
            }

            /**
             * Skip to the "has siblings?" check if we're skipping children or if
             * the node has no children.
             */
            if (!skipChildrenForCurrentNode && node.children.length > 0) {
                // Go to first child
                return node.children[0];
            }

            // If we're at the root node with no children, we're done
            if (node.type === 'root' && node.parent === null) {
                return null;
            }

            // Try to go to next sibling
            if (node.parent) {
                const siblings = node.parent.children;
                const currentIndex = siblings.indexOf(node);

                // Node was removed from parent during traversal
                if (currentIndex === -1) {
                /**
                 * This is a special case - the node we were examining is no longer
                 * in the tree. In this case, we need to find what would have been
                 * the next node.
                 */
                    return getNextNodeInAncestry(node.parent);
                }

                // If there's a next sibling, go to it
                if (currentIndex < siblings.length - 1) {
                    return siblings[currentIndex + 1];
                }
            }

            // No more siblings, go up to parent and continue from there
            return getNextNodeInAncestry(node.parent);
        };

        // Before we begin, patch the remove method to detect when nodes are removed
        const originalRemove = Node.prototype.remove;

        /**
         * Override the remove method to detect removals during iteration
         * eslint-disable-next-line func-names.
         */
        Node.prototype.remove = function remove() {
            // If this is the current node being traversed, mark it as removed
            if (this === currentNode) {
                wasRemoved = true;
            }
            return originalRemove.call(this);
        };

        return {
            next() {
                // Make sure to restore the original remove method when done
                if (!currentNode) {
                    Node.prototype.remove = originalRemove;
                    return { value: undefined, done: true };
                }

                // If we haven't started yet, return the initial node
                if (!started) {
                    started = true;

                    // Define the skipChildren method for the current node
                    currentNode.skipChildren = function skipChildren() {
                        skipChildrenForCurrentNode = true;
                    };

                    return { value: currentNode, done: false };
                }

                // Reset removal and skip flags
                wasRemoved = false;
                skipChildrenForCurrentNode = false;

                // We've already processed currentNode, now get the next one
                const nextNode = getNextNode(currentNode);

                // Keep a reference to the current node before updating
                const nodeToReturn = currentNode;

                // Update currentNode for the next iteration
                currentNode = nextNode;

                // Define the skipChildren method for the new node if it exists
                if (currentNode) {

                    currentNode.skipChildren = function skipChildren() {
                        skipChildrenForCurrentNode = true;
                    };
                } else {
                    // We're done with traversal, restore the original remove method
                    Node.prototype.remove = originalRemove;
                }

                return { value: nodeToReturn, done: false };
            }
        };
    }

    /**
     * Appends one or more child nodes to this node's children array.
     * Accepts individual nodes or arrays of nodes.
     * @param {...(Node|Node[])} nodes - The nodes to append (can be individual nodes or arrays)
     * @returns {Node[]} The appended nodes
     */
    appendChild(...nodes) {
        const flatNodes = nodes.flat();

        for (const node of flatNodes) {
            node.parent = this;
            this.children.push(node);
        }
        return flatNodes;
    }

    /**
     * Helper method to build a single CSS rule string.
     * @private
     */
    #buildCssRule(selector, declarations, nestedChildren, options) {
        const {
            includeBraces,
            includeSelector,
            includeNestedRules,
            flattenNested,
            singleLine,
            indent
        } = options;

        const spaces = singleLine ? '' : ' '.repeat(indent);
        const newline = singleLine ? ' ' : '\n';
        let result = '';

        // Add selector if requested
        if (includeSelector && selector) {
            result += `${spaces}${selector}`;
        }

        // Add opening brace if requested
        if (includeBraces) {
            result += includeSelector && selector ? ` {${newline}` : `{${newline}`;
        }

        // Add declarations
        const declIndent = includeBraces && !singleLine ? indent + 4 : indent;
        const declSpaces = singleLine ? '' : ' '.repeat(declIndent);

        const declarationEntries = Object.entries(declarations);
        for (let i = 0; i < declarationEntries.length; i++) {
            const [prop, value] = declarationEntries[i];

            if (singleLine) {
                result += `${prop}: ${value};`;
                if (i < declarationEntries.length - 1 || nestedChildren.length > 0) {
                    result += ' ';
                }
            } else {
                result += `${declSpaces}${prop}: ${value};${newline}`;
            }
        }

        // Add nested rules if requested
        if (includeNestedRules && nestedChildren.length > 0) {
            for (const nested of nestedChildren) {
                if (nested.type === 'css-rule') {
                    // Get nested rule's declarations and children
                    const nestedDeclarations = nested.cssDeclarations || {};
                    const nestedNested = nested.children?.filter((c) => { return c.type === 'css-rule' || c.type === 'css-at-rule'; }
                    ) || [];

                    if (flattenNested) {
                        // Flatten - build full selector path
                        const fullSelector = `${selector} ${nested.cssSelector}`;
                        if (!singleLine) {
                            result += '\n';
                        }
                        result += this.#buildCssRule(
                            fullSelector,
                            nestedDeclarations,
                            nestedNested,
                            { ...options, indent }
                        );
                    } else {
                        // Preserve nesting
                        result += this.#buildCssRule(
                            nested.cssSelector,
                            nestedDeclarations,
                            nestedNested,
                            { ...options, indent: declIndent }
                        );
                    }

                    if (!singleLine) {
                        result += '\n';
                    }
                }
            }
        }

        // Add closing brace if requested
        if (includeBraces) {
            if (singleLine) {
                result += ' }';
            } else {
                result += `${spaces}}`;
            }
        }

        return result;
    }

    /**
     * Creates a new element node with optional attributes and content.
     * Returns an array containing [openingTag, closingTag] for non-void elements,
     * or [openingTag] for void elements.
     *
     * @param {string} tagName - The HTML tag name (e.g., 'div', 'p', 'span')
     * @param {Object} [attributes={}] - Element attributes as key-value pairs
     * @param {string|Node|Node[]} [content=null] - Text content, single node, or array of nodes
     * @returns {Node[]} Array of nodes [opening, closing?]
     *
     * @example
     * // Non-void element - returns [opening, closing]
     * const nodes = container.createNode('div', { class: 'box' }, 'Hello');
     * container.appendChild(...nodes);
     *
     * @example
     * // Void element - returns [opening]
     * const nodes = container.createNode('img', { src: 'photo.jpg' });
     * container.appendChild(...nodes);
     */
    createNode(tagName, attributes = {}, content = null) {
        const openTag = new Node('tag-open', tagName, attributes);

        // Add content if provided
        if (content !== null) {
            if (typeof content === 'string') {
                const textNode = new Node('text');
                textNode.content = content;
                openTag.children.push(textNode);
                textNode.parent = openTag;
            } else if (Array.isArray(content)) {
            // Flatten in case content contains arrays (from createNode)
                const flatContent = content.flat();
                for (const child of flatContent) {
                    openTag.children.push(child);
                    child.parent = openTag;
                }
            } else if (content instanceof Node) {
                openTag.children.push(content);
                content.parent = openTag;
            }
        }

        // Return array with closing tag for non-void elements
        if (!VOID_ELEMS.includes(tagName.toLowerCase())) {
            const closeTag = new Node('tag-close', tagName);
            return [openTag, closeTag];
        }

        // Void elements return only opening tag
        return [openTag];
    }

    /**
     * Finds at-rules (@media, @keyframes, @supports, etc.) in the CSS tree.
     * @param {string|null} [name=null] - At-rule name to filter by (e.g., 'media', 'keyframes'), or null for all at-rules
     * @returns {Node[]} Array of at-rule nodes
     *
     * @example
     * // Find all @media rules
     * const mediaRules = style.cssFindAtRules('media');
     *
     * @example
     * // Find all at-rules
     * const allAtRules = style.cssFindAtRules();
     */
    cssFindAtRules(name = null) {
        const results = [];

        const searchRules = (node) => {
            if (node.type === 'css-at-rule') {
                if (name === null || node.cssName === name) {
                    results.push(node);
                }
            }

            // Recursively search children
            if (node.children) {
                for (const child of node.children) {
                    searchRules(child);
                }
            }
        };

        searchRules(this);
        return results;
    }

    /**
     * Finds CSS rules that match a given selector.
     * @param {string} selector - CSS selector to search for (e.g., '.card', '#wrapper', 'div')
     * @param {Object} [options={}] - Search options
     * @param {boolean} [options.includeCompound=true] - Whether to include compound selectors (e.g., '.card.active' when searching for '.card')
     * @param {boolean} [options.shallow=true] - Whether to include only direct rules (excludes nested children and descendant selectors)
     * @returns {Node[]} Array of matching CSS rule nodes
     *
     * @example
     * // Find all rules for .card (includes .card.active)
     * const cardRules = style.cssFindRules('.card');
     *
     * @example
     * // Find only exact .card rules (excludes .card.active)
     * const exactCard = style.cssFindRules('.card', { includeCompound: false });
     *
     * @example
     * // Find #wrapper rules, excluding nested rules like #wrapper div
     * const wrapperOnly = style.cssFindRules('#wrapper', { shallow: true });
     */
    cssFindRules(selector, options = {}) {
        const { includeCompound = true, shallow = false } = options;
        const results = [];

        const searchRules = (node) => {
            if (node.type === 'css-rule') {
                let matches = false;

                if (includeCompound) {
                    // Loose match - selector appears anywhere
                    // For tag selectors, use word boundaries to avoid partial matches
                    const isTagSelector = !selector.startsWith('.') && !selector.startsWith('#') && !selector.startsWith('[');

                    if (isTagSelector) {
                        // Word boundary match for tags (p, a, table, etc.)
                        const regex = new RegExp(`\\b${selector}\\b`, 'i');
                        matches = regex.test(node.cssSelector);
                    } else {
                        // Simple contains for classes/IDs
                        matches = node.cssSelector.includes(selector);
                    }
                } else {
                    // Exact match - split on both commas AND spaces
                    const selectors = node.cssSelector
                        .split(',')
                        .flatMap((s) => { return s.trim().split(REGEX.whitespace); })
                        .map((s) => { return s.trim(); });

                    matches = selectors.includes(selector);
                }

                if (matches) {
                    if (shallow) {
                        const clonedNode = Object.create(Object.getPrototypeOf(node));
                        Object.assign(clonedNode, node);
                        clonedNode.children = node.children.filter((child) => { return child.type !== 'css-rule' && child.type !== 'css-at-rule'; }
                        );
                        results.push(clonedNode);
                    } else {
                        results.push(node);
                    }
                }
            }

            if (node.children) {
                for (const child of node.children) {
                    searchRules(child);
                }
            }
        };

        searchRules(this);
        return results;
    }

    /**
     * Finds a specific CSS variable (custom property) by name.
     * @param {string} name - Variable name (with or without '--' prefix)
     * @param {Node|null} [rule=null] - Specific rule to search in, or null to search all rules
     * @returns {string|null} Variable value or null if not found
     *
     * @example
     * // Find --primary-color
     * const primary = style.cssFindVariable('--primary-color');
     *
     * @example
     * // Find variable without -- prefix
     * const spacing = style.cssFindVariable('spacing');
     */
    cssFindVariable(name, rule = null) {
        // Ensure name has -- prefix
        const varName = name.startsWith('--') ? name : `--${name}`;

        if (rule) {
            // Search only in specified rule
            return rule.cssDeclarations?.[varName] || null;
        }

        // Search through all rules
        const searchRule = (node) => {
            if (node.cssDeclarations && node.cssDeclarations[varName]) {
                return node.cssDeclarations[varName];
            }

            if (node.children) {
                for (const child of node.children) {
                    const found = searchRule(child);
                    if (found) return found;
                }
            }

            return null;
        };

        return searchRule(this);
    }

    /**
     * Finds all CSS variables (custom properties) in the CSS tree with their scope paths.
     * @param {Object} [options={}] - Options for variable extraction
     * @param {boolean} [options.includeRoot=false] - Whether to include 'root' in scope path for root-level variables
     * @returns {Array<{name: string, value: string, scope: string, rule: Node}>} Array of variable objects with metadata
     *
     * @example
     * // Get all CSS variables
     * const vars = style.cssFindVariables();
     * // [{name: '--primary', value: '#007bff', scope: ':root', rule: Node}]
     */
    cssFindVariables(options = {}) {
        const { includeRoot = false } = options;
        const variables = [];

        const extractVars = (node, scopePath = '') => {
            // Build scope path
            let currentScope = scopePath;

            if (node.type === 'css-rule') {
                currentScope = scopePath ? `${scopePath} > ${node.cssSelector}` : node.cssSelector;
            } else if (node.type === 'css-at-rule') {
                const atRuleStr = `@${node.cssName}${node.cssParams ? ` ${node.cssParams}` : ''}`;
                currentScope = scopePath ? `${scopePath} > ${atRuleStr}` : atRuleStr;
            }

            // Extract variables from declarations
            if (node.cssDeclarations) {
                for (const [prop, value] of Object.entries(node.cssDeclarations)) {
                    if (prop.startsWith('--')) {
                        // Clean up scope path (remove 'root' if at root level and option says so)
                        let finalScope = currentScope;
                        if (!includeRoot && node.parent && node.parent.type === 'css-root') {
                            // This is a top-level rule, check if it's :root
                            if (node.cssSelector === ':root') {
                                finalScope = ':root';
                            } else {
                                finalScope = node.cssSelector;
                            }
                        }

                        variables.push({
                            name: prop,
                            value,
                            scope: finalScope,
                            rule: node
                        });
                    }
                }
            }

            // Recursively process children
            if (node.children) {
                for (const child of node.children) {
                    extractVars(child, currentScope);
                }
            }
        };

        // Start extraction from this node
        extractVars(this);

        return variables;
    }

    /**
     * Converts CSS rule nodes back to a CSS string with flexible formatting options.
     *
     * Behavior:
     * - If called with node(s): Converts those specific nodes
     * - If called without params: Searches for all <style> tags from this node down and converts their CSS
     *
     * @param {Node|Node[]|Object} [nodesOrOptions] - CSS nodes to convert, or options object if converting this node
     * @param {Object} [options={}] - Formatting options (only when first param is nodes)
     *
     * @param {boolean} [options.includeComments=false] - Whether to include CSS comments in output
     * @param {boolean} [options.includeNestedRules=true] - Whether to include nested rules within parent rules
     * @param {boolean} [options.flattenNested=false] - Whether to flatten nested rules into separate top-level rules with full selectors (e.g., ".card .title" instead of nested)
     * @param {boolean} [options.includeBraces=true] - Whether to include { } around declarations
     * @param {boolean} [options.includeSelector=true] - Whether to include the selector before declarations
     * @param {boolean} [options.combineDeclarations=true] - Whether to merge declarations from multiple rules with the same selector
     * @param {boolean} [options.singleLine=false] - Whether to output CSS on a single line instead of multi-line
     * @param {number} [options.indent=0] - Indentation level in spaces for multi-line output
     *
     * @returns {string} Formatted CSS string
     *
     * @example
     * // Convert all styles in document
     * const css = dom.cssToString();
     *
     * @example
     * // Convert specific rules
     * const rules = style.cssFindRules('.card');
     * const css = style.cssToString(rules, { includeNestedRules: false });
     *
     * @example
     * // Get just declarations (no selector/braces)
     * const css = style.cssToString(rules, {
     *   includeSelector: false,
     *   includeBraces: false
     * });
     */
    cssToString(nodesOrOptions, options = {}) {
        let nodesToConvert;
        let finalOptions;

        if (nodesOrOptions === undefined || (typeof nodesOrOptions === 'object' && !Array.isArray(nodesOrOptions) && !nodesOrOptions.type)) {
            // No nodes provided - find ALL style tags from this node down
            finalOptions = nodesOrOptions || {};

            const styleTags = this.querySelectorAll('style');

            if (styleTags.length > 0) {
                // Found style tags - extract all their CSS children into one array
                nodesToConvert = styleTags.flatMap((tag) => { return tag.children || []; });
            } else {
                // No style tags - treat this node's children as CSS nodes
                nodesToConvert = this.children || [this];
            }
        } else {
            // Nodes provided explicitly
            nodesToConvert = nodesOrOptions;
            finalOptions = options;
        }

        // Extract options with defaults
        const {
            includeComments = false,
            includeNestedRules = true,
            flattenNested = false,
            includeBraces = true,
            includeSelector = true,
            combineDeclarations = true,
            singleLine = false,
            indent = 0
        } = finalOptions;

        // Rebuild options object with defaults applied
        const processedOptions = {
            includeComments,
            includeNestedRules,
            flattenNested,
            includeBraces,
            includeSelector,
            combineDeclarations,
            singleLine,
            indent
        };

        // Normalize nodes to array
        const ruleArray = Array.isArray(nodesToConvert) ? nodesToConvert : [nodesToConvert];

        // Group rules by selector if combining declarations
        if (combineDeclarations) {
            const rulesBySelector = new Map();

            for (const rule of ruleArray) {
                if (rule.type === 'css-rule') {
                    const selector = rule.cssSelector;

                    if (!rulesBySelector.has(selector)) {
                        rulesBySelector.set(selector, []);
                    }

                    rulesBySelector.get(selector).push(rule);
                } else if (rule.type === 'comment' && rule.commentType === 'css' && includeComments) {
                    // Handle comments separately
                    const key = `__comment_${Math.random()}`;
                    rulesBySelector.set(key, [rule]);
                }
            }

            // Process each selector group
            let result = '';
            for (const [selector, rules] of rulesBySelector) {
                // Handle comments
                if (selector.startsWith('__comment_')) {
                    const spaces = singleLine ? '' : ' '.repeat(indent);
                    result += `${spaces}/*${rules[0].content}*/`;
                    if (!singleLine) {
                        result += '\n';
                    }
                    continue;
                }

                // Combine all declarations for this selector
                const combinedDeclarations = {};
                const nestedChildren = [];

                for (const rule of rules) {
                    if (rule.cssDeclarations) {
                        Object.assign(combinedDeclarations, rule.cssDeclarations);
                    }

                    // Collect nested rules from first occurrence only
                    if (includeNestedRules && rule.children && nestedChildren.length === 0) {
                        for (const child of rule.children) {
                            if (child.type === 'css-rule' || child.type === 'css-at-rule') {
                                nestedChildren.push(child);
                            }
                        }
                    }
                }

                // Build CSS for this selector
                result += this.#buildCssRule(
                    selector,
                    combinedDeclarations,
                    nestedChildren,
                    processedOptions
                );

                if (!singleLine) {
                    result += '\n';
                }
            }

            return result.trimEnd();
        }

        // Not combining - process each rule separately
        let result = '';
        for (const rule of ruleArray) {
            if (rule.type === 'css-rule') {
                const declarations = rule.cssDeclarations || {};
                const nestedChildren = [];

                if (includeNestedRules && rule.children) {
                    for (const child of rule.children) {
                        if (child.type === 'css-rule' || child.type === 'css-at-rule') {
                            nestedChildren.push(child);
                        }
                    }
                }

                result += this.#buildCssRule(
                    rule.cssSelector,
                    declarations,
                    nestedChildren,
                    processedOptions
                );

                if (!singleLine) {
                    result += '\n';
                }
            } else if (rule.type === 'comment' && rule.commentType === 'css' && includeComments) {
                const spaces = singleLine ? '' : ' '.repeat(indent);
                result += `${spaces}/*${rule.content}*/`;
                if (!singleLine) {
                    result += '\n';
                }
            }
        }

        return result.trimEnd();
    }

    /**
     * Converts CSS tree nodes back to CSS string format.
     * Used internally when converting style tags to HTML.
     * @param {Node[]} cssNodes - Array of CSS nodes to convert
     * @param {number} [indent=0] - Current indentation level
     * @returns {string} CSS string
     * @private
     */
    #cssTreeToString(cssNodes, indent = 0) {
        let css = '';

        for (const node of cssNodes) {
            if (node.type === 'css-rule' || node.type === 'css-at-rule') {
                css += this.cssToString(node, {
                    includeNestedRules: true,
                    includeBraces: true,        // Explicitly set
                    includeSelector: true,      // Explicitly set
                    combineDeclarations: false, // Don't combine - just convert this one rule
                    indent: indent * 4
                });
                css += '\n';
            } else if (node.type === 'comment' && node.commentType === 'css') {
                const indentStr = ' '.repeat(indent * 4);
                css += `${indentStr}/*${node.content}*/\n`;
            } else if (node.children) {
                css += this.#cssTreeToString(node.children, indent);
            }
        }

        return css;
    }

    /**
     * Executes a basic CSS selector and returns matching nodes.
     * @param {string} selector - CSS selector to execute
     * @returns {Node[]} Matching nodes
     * @private
     */
    #executeBasicSelector(selector) {
        const results = [];

        // Parse basic selectors
        const selectorParts = selector.match(REGEX.querySelectorParts)
            ?.filter(Boolean)
            ?.join('') || '';

        const tagMatch = selectorParts.match(REGEX.queryTagMatch);
        const idMatch = selectorParts.match(REGEX.queryIdMatch);
        const classMatches = selectorParts.match(REGEX.queryClassMatches);
        const attrMatches = selectorParts.match(REGEX.queryAttributeMatches);

        const tagName = tagMatch ? tagMatch[0] : null;
        const id = idMatch ? idMatch[1] : null;
        const classes = classMatches ? classMatches.map((c) => { return c.substring(1); }) : [];

        // Parse attribute selectors
        const attributes = [];
        if (attrMatches) {
            for (const attrMatch of attrMatches) {
                const attrContent = attrMatch.slice(1, -1); // Remove [ and ]

                // Check for value comparison
                if (attrContent.includes('=')) {
                    const [name, rawValue] = attrContent.split('=');
                    // Remove quotes from value if present
                    const value = rawValue.replace(REGEX.rawValue, '$1');
                    attributes.push({ name, value, hasValue: true });
                } else {
                    // Just check for attribute existence
                    attributes.push({ name: attrContent, hasValue: false });
                }
            }
        }

        // For "pre div" or other descendant selectors
        const isDescendantSelector = selector.includes(' ');
        if (isDescendantSelector) {
            const selectorParts = selector.split(REGEX.whitespace);

            // Start by finding ancestors
            const ancestors = this.#executeBasicSelector(selectorParts[0]);

            // For each ancestor, find matching descendants
            for (const ancestor of ancestors) {
                // Get descendants matching the rest of the selector
                const descendantSelector = selectorParts.slice(1).join(' ');
                const descendants = ancestor.#executeBasicSelector(descendantSelector);

                // Add them to results
                for (const descendant of descendants) {
                    if (!results.includes(descendant)) {
                        results.push(descendant);
                    }
                }
            }

            return results;
        }

        // Traverse the tree
        const queue = [this];

        while (queue.length > 0) {
            const node = queue.shift();

            // Check if the node matches the selector
            if (node.type === 'tag-open') {
                let matches = true;

                // Check tag name
                if (tagName && node.name !== tagName) {
                    matches = false;
                }

                // Check ID
                if (id && node.getAttribute('id') !== id) {
                    matches = false;
                }

                // Check classes
                if (classes.length > 0) {
                    const nodeClasses = (node.getAttribute('class') || '').split(REGEX.whitespace);
                    for (const cls of classes) {
                        if (!nodeClasses.includes(cls)) {
                            matches = false;
                            break;
                        }
                    }
                }

                // Check attributes
                if (attributes.length > 0) {
                    for (const attr of attributes) {
                        const nodeAttrValue = node.getAttribute(attr.name);

                        if (attr.hasValue) {
                            // Check attribute has specific value
                            if (nodeAttrValue !== attr.value) {
                                matches = false;
                                break;
                            }
                        } else if (nodeAttrValue === undefined) {
                            matches = false;
                            break;
                        }
                    }
                }

                if (matches) {
                    results.push(node);
                }
            }

            // Add children to queue
            queue.push(...node.children);
        }

        return results;
    }

    /**
     * Extracts a node (and its closing tag if applicable) from its current parent.
     * The node and its children remain intact, but it's removed from the tree.
     * This is used internally when moving nodes.
     * @param {Node} node - The node to extract
     * @returns {Object} Object with {opening, closing, removedCount}
     */
    #extractNode(node) {
        if (!node.parent) {
            return { opening: node, closing: null, whitespace: null, removedCount: 0, startIndex: -1 };
        }

        const parentRef = node.parent;
        const index = parentRef.children.indexOf(node);

        if (index === -1) {
            return { opening: node, closing: null, whitespace: null, removedCount: 0, startIndex: -1 };
        }

        let closing = null;
        let whitespace = null;
        let removedCount = 1;
        let startIndex = index;

        // Check if there's a whitespace-only text node before this node
        if (index > 0) {
            const prevNode = parentRef.children[index - 1];
            if (prevNode.type === 'text' && prevNode.content.trim() === '') {
                // Include the whitespace node in the extraction
                whitespace = prevNode;
                startIndex = index - 1;
                removedCount += 1;
            }
        }

        // IMPORTANT: Find closing tag BEFORE removing from tree
        if (node.type === 'tag-open') {
            closing = this.#findClosingTag(node);
            if (closing) {
                removedCount += 1;
            }
        }

        // Remove from parent's children array (including whitespace if found)
        parentRef.children.splice(startIndex, removedCount);

        // Clear parent references
        node.parent = null;
        if (closing) {
            closing.parent = null;
        }
        if (whitespace) {
            whitespace.parent = null;
        }

        return { opening: node, closing, whitespace, removedCount, startIndex };
    }

    /**
     * Finds all nodes with a specific attribute.
     * @param {string} attrName - Name of the attribute to search for
     * @returns {Node[]} Nodes with the specified attribute
     */
    findAllByAttr(attrName) {
        const results = [];
        const queue = [this];

        while (queue.length > 0) {
            const node = queue.shift();
            if (node.type === 'tag-open' && Object.prototype.hasOwnProperty.call(node.attributes, attrName)) {
                results.push(node);
            }
            queue.push(...node.children);
        }

        return results;
    }

    /**
     * Finds all nodes with a specific tag name.
     * @param {string} tagName - Tag name to search for
     * @returns {Node[]} Nodes with the specified tag name
     */
    findAllByTag(tagName) {
        const results = [];
        const queue = [this];

        while (queue.length > 0) {
            const node = queue.shift();
            if (node.type === 'tag-open' && node.name === tagName) {
                results.push(node);
            }
            queue.push(...node.children);
        }

        return results;
    }

    /**
     * Finds all nodes of a specific type.
     * @param {string} nodeType - Type to search for ('tag-open', 'text', 'comment', etc.)
     * @returns {Node[]} Nodes matching the specified type
     */
    findAllByType(nodeType) {
        const results = [];
        const queue = [this];

        while (queue.length > 0) {
            const node = queue.shift();
            if (node.type === nodeType ||
                (nodeType === 'script-block' && node.type === 'tag-open' && node.scriptBlock)
            ) {
                results.push(node);
            }
            queue.push(...node.children);
        }

        return results;
    }

    /**
     * Finds the closing tag for an opening tag.
     * @param {Node} openingTag - The opening tag node
     * @returns {Node|null} The closing tag, or null if it's a void element or not found
     */
    #findClosingTag(openingTag) {
        if (!openingTag.parent || openingTag.type !== 'tag-open') {
            return null;
        }

        const index = openingTag.parent.children.indexOf(openingTag);
        if (index === -1) {
            return null;
        }

        const candidate = openingTag.parent.children[index + 1];
        if (candidate &&
            candidate.type === 'tag-close' &&
            candidate.name === openingTag.name) {
            return candidate;
        }

        return null;
    }

    /**
     * Finds matching nodes based on a selector, including :not() support.
     * @param {string} selector - CSS selector
     * @returns {Node[]} Matching nodes
     * @private
     */
    #findMatchingNodes(selector) {
        const results = [];

        // Extract :not() selectors
        const notSelectors = [];
        const mainSelector = selector.replace(REGEX.notSelector, (match, notSelector) => {
            notSelectors.push(notSelector.trim());
            return ''; // Remove :not() from the main selector
        }).trim();

        // If we only have :not() selectors with no main selector, start with all nodes
        let candidateNodes = [];
        if (mainSelector === '') {
            // Get all tag nodes if no main selector (equivalent to *)
            const queue = [this];
            while (queue.length > 0) {
                const node = queue.shift();
                if (node.type === 'tag-open') {
                    candidateNodes.push(node);
                }
                queue.push(...node.children);
            }
        } else {
            // Find nodes matching the main selector
            candidateNodes = this.#executeBasicSelector(mainSelector);
        }

        // Filter out nodes that match any :not() selector
        for (const node of candidateNodes) {
            let includeNode = true;

            for (const notSelector of notSelectors) {
                /**
                 * We need to find if this specific node is matched by the not selector.
                 * Start from the root to find all nodes matching the not selector.
                 */
                const root = this.#findRoot();
                const notMatches = root.#executeBasicSelector(notSelector);

                // If the current node is in the not matches, exclude it
                if (notMatches.includes(node)) {
                    includeNode = false;
                    break;
                }
            }

            if (includeNode) {
                results.push(node);
            }
        }

        return results;
    }

    /**
     * Finds the root node of the tree.
     * @returns {Node} Root node
     * @private
     */
    #findRoot() {
        let node = this;
        while (node.parent !== null) {
            node = node.parent;
        }
        return node;
    }

    /**
     * Recursively collects all descendant nodes of a given node.
     * This includes all nodes in the node's children array and their descendants.
     * @param {Node} node - The node to collect descendants from
     * @returns {Node[]} Array of all descendant nodes
     */
    #getAllDescendants(node) {
        const descendants = [];

        const collectDescendants = (currentNode) => {
            for (const child of currentNode.children) {
                descendants.push(child);
                collectDescendants(child);
            }
        };

        collectDescendants(node);
        return descendants;
    }

    /**
     * Gets the value of an attribute.
     * @param {string} name - Attribute name
     * @returns {string|undefined} Attribute value or undefined if not found
     */
    getAttribute(name) {
        return this.attributes[name];
    }

    /**
     * Gets all comment nodes from the tree, including CSS comments.
     * Handles both regular HTML/JS comments and CSS comment structures.
     * @param {Object} [options={}] - Options for comment extraction
     * @param {boolean} [options.includeContent=true] - Whether to include comment content
     * @param {boolean} [options.includeType=true] - Whether to include commentType property
     * @returns {Array<Node|Object>} Array of comment nodes or comment objects
     */
    getComments(options = {}) {
        const { includeContent = true, includeType = true } = options;
        const comments = [];

        const extractComments = (node) => {
            // Check if this is a comment node (regular Node structure)
            if (node.type === 'comment') {
                if (includeContent || includeType) {
                    // Return a simplified object
                    const commentObj = {};
                    if (includeContent) commentObj.content = node.content;
                    if (includeType && node.commentType) commentObj.commentType = node.commentType;
                    commentObj.node = node; // Keep reference to original node
                    comments.push(commentObj);
                } else {
                    comments.push(node);
                }
            }

            // Check children array for both Node and CSSRule structures
            if (node.children && Array.isArray(node.children)) {
                for (const child of node.children) {
                    extractComments(child);
                }
            }
        };

        extractComments(this);
        return comments;
    }

    /**
     * Gets the attribute string for a node.
     * @param {Node} node - Node to get attributes for
     * @returns {string} Attribute string
     * @private
     */
    #getNodeAttributesString(node) {
        let attrs = '';
        for (const [key, value] of Object.entries(node.attributes)) {
            if (value === '__EMPVAL__') {
                attrs += ` ${key}`;
                // eslint-disable-next-line no-continue
                continue;
            }
            attrs += ` ${key}="${value}"`;
        }
        return attrs;
    }

    /**
     * Gets all nodes of a specific type from the tree.
     * Works with both Node types and CSSRule types.
     * @param {string} type - Node type to search for (e.g., 'comment', 'text', 'tag-open', 'rule', 'at-rule')
     * @returns {Array<Node>} Array of nodes matching the specified type
     */
    getNodesByType(type) {
        const results = [];

        const searchNodes = (node) => {
            if (node.type === type) {
                results.push(node);
            }

            // Recursively search children
            if (node.children && Array.isArray(node.children)) {
                for (const child of node.children) {
                    searchNodes(child);
                }
            }
        };

        searchNodes(this);
        return results;
    }

    /**
     * Gets the HTML tag for this node without its children; e.g., "<div id='main'>"
     * @returns {string} HTML tag
     */
    getTag() {
        if (this.type === 'text') {
            return this.content;
        }

        if (this.type === 'comment') {
            const commentType = this.commentType || 'html-comment';

            if (commentType === 'js-single-line') {
                return `//${this.content}`;
            } if (commentType === 'js-multi-line') {
                return `/*${this.content}*/`;
            }
            return `<!--${this.content}-->`;
        }

        if (this.type === 'tag-open' || this.type === 'tag-close') {
            const attrs = this.#getNodeAttributesString(this);
            return `<${this.name}${attrs}>`;
        }

        return '';
    }

    /**
     * Gets the HTML content of this node's children without the node's own tags.
     * @param {boolean} [showComments=false] - Whether to include comments in the output
     * @returns {string} HTML representation of the node's children
     */
    innerHtml(showComments = false) {
        // Simply concatenate all children's HTML
        let result = '';
        for (const child of this.children) {
            result += child.toHtml(showComments);
        }
        return result;
    }

    /**
     * Inserts one or more nodes after this node.
     * Accepts individual nodes or arrays of nodes.
     *
     * If a node being inserted is already in the tree, it will be moved (along with
     * its closing tag if applicable) to the new location.
     *
     * Behavior based on node type:
     * - tag-open (non-void): Inserts after the closing tag (outside the element)
     * - tag-open (void): Inserts after the void element
     * - tag-close: Inserts after the closing tag
     * - text/comment: Inserts after this node
     *
     * @param {...(Node|Node[])} nodes - The nodes to insert
     * @returns {Node} This node for chaining
     * @throws {Error} If node has no parent or is not found in parent's children
     *
     * @example
     * // <div>content</div> → <div>content</div>newNode
     * divOpenTag.insertAfter(newNode);
     *
     * @example
     * // Move A after B: <A/><B/> → <B/><A/>
     * nodeB.insertAfter(nodeA);
     */
    insertAfter(...nodes) {
        if (!this.parent) {
            throw new Error('Cannot insert after a node with no parent');
        }

        const flatNodes = nodes.flat();

        let targetNode = this;

        // If this is an opening tag (non-void), find its closing tag
        if (this.type === 'tag-open' && !this.#isVoidElement(this)) {
            const closingTag = this.#findClosingTag(this);
            if (closingTag) {
                targetNode = closingTag;
            }
        }

        // Get the initial index (might change as we extract nodes)
        let insertIndex = targetNode.parent.children.indexOf(targetNode);
        if (insertIndex === -1) {
            throw new Error('Node not found in parent\'s children');
        }

        // Start inserting after the target
        insertIndex += 1;

        // Process each node
        for (const node of flatNodes) {
            let closingTag = null;
            let whitespace = null;

            // If the node is already in the tree, extract it first
            if (node.parent) {
                const isSameParent = node.parent === targetNode.parent;

                // Extract the node (and its closing tag if applicable)
                const extracted = this.#extractNode(node);
                closingTag = extracted.closing;
                whitespace = extracted.whitespace;

                // If we extracted from the same parent and it was before our insert point,
                // we need to adjust the insert index
                if (isSameParent && extracted.startIndex !== -1 && extracted.startIndex < insertIndex) {
                    insertIndex -= extracted.removedCount;
                }
            }

            // If there's whitespace, insert it first
            if (whitespace) {
                whitespace.parent = targetNode.parent;
                targetNode.parent.children.splice(insertIndex, 0, whitespace);
                insertIndex += 1;
            }

            // Insert the opening tag
            node.parent = targetNode.parent;
            targetNode.parent.children.splice(insertIndex, 0, node);
            insertIndex += 1;

            // If there's a closing tag, insert it too
            if (closingTag) {
                closingTag.parent = targetNode.parent;
                targetNode.parent.children.splice(insertIndex, 0, closingTag);
                insertIndex += 1;
            }
        }

        return this;
    }

    /**
     * Inserts one or more nodes before this node.
     * Accepts individual nodes or arrays of nodes.
     *
     * If a node being inserted is already in the tree, it will be moved (along with
     * its closing tag if applicable) to the new location.
     *
     * Behavior based on node type:
     * - tag-open (non-void): Inserts before the opening tag (outside the element)
     * - tag-open (void): Inserts before the void element
     * - tag-close: Inserts before the matching opening tag (outside the element)
     * - text/comment: Inserts before this node
     *
     * @param {...(Node|Node[])} nodes - The nodes to insert
     * @returns {Node} This node for chaining
     * @throws {Error} If node has no parent or is not found in parent's children
     *
     * @example
     * // <div>content</div> → newNode<div>content</div>
     * divOpenTag.insertBefore(newNode);
     *
     * @example
     * // Move B before A: <A/><B/> → <B/><A/>
     * nodeA.insertBefore(nodeB);
     */
    insertBefore(...nodes) {
        if (!this.parent) {
            throw new Error('Cannot insert before a node with no parent');
        }

        const flatNodes = nodes.flat();

        let targetNode = this;

        // If this is a closing tag, redirect to its opening tag
        if (this.type === 'tag-close') {
            const closeIndex = this.parent.children.indexOf(this);
            if (closeIndex === -1) {
                throw new Error('Node not found in parent\'s children');
            }

            const openCandidate = this.parent.children[closeIndex - 1];
            if (openCandidate &&
            openCandidate.type === 'tag-open' &&
            openCandidate.name === this.name) {
                targetNode = openCandidate;
            }
        }

        // Get the initial index (might change as we extract nodes)
        let insertIndex = targetNode.parent.children.indexOf(targetNode);
        if (insertIndex === -1) {
            throw new Error('Node not found in parent\'s children');
        }

        // Process each node
        for (const node of flatNodes) {
            let closingTag = null;
            let whitespace = null;

            // If the node is already in the tree, extract it first
            if (node.parent) {
                const isSameParent = node.parent === targetNode.parent;

                // Extract the node (and its closing tag if applicable)
                const extracted = this.#extractNode(node);
                closingTag = extracted.closing;
                whitespace = extracted.whitespace;

                // If we extracted from the same parent and it was before our insert point,
                // we need to adjust the insert index
                if (isSameParent && extracted.startIndex !== -1 && extracted.startIndex < insertIndex) {
                    insertIndex -= extracted.removedCount;
                }
            }

            // If there's whitespace, insert it first
            if (whitespace) {
                whitespace.parent = targetNode.parent;
                targetNode.parent.children.splice(insertIndex, 0, whitespace);
                insertIndex += 1;
            }

            // Insert the opening tag
            node.parent = targetNode.parent;
            targetNode.parent.children.splice(insertIndex, 0, node);
            insertIndex += 1;

            // If there's a closing tag, insert it too
            if (closingTag) {
                closingTag.parent = targetNode.parent;
                targetNode.parent.children.splice(insertIndex, 0, closingTag);
                insertIndex += 1;
            }
        }

        return this;
    }

    /**
     * Inserts HTML string at a specific position relative to this element.
     * Mimics the browser's insertAdjacentHTML API.
     *
     * @param {string} position - Position relative to element:
     *   - 'beforebegin': Before the element (outside)
     *   - 'afterbegin': At the start of element's children (inside)
     *   - 'beforeend': At the end of element's children (inside)
     *   - 'afterend': After the element (outside)
     * @param {string} html - HTML string to parse and insert
     * @returns {Node} This node for chaining
     * @throws {Error} If position is invalid, parser not found, or operation not allowed
     *
     * @example
     * // <div id="container">Hello</div>
     * container.insertAdjacentHTML('beforebegin', '<p>Before</p>');
     * // <p>Before</p><div id="container">Hello</div>
     *
     * @example
     * container.insertAdjacentHTML('afterbegin', '<span>Start</span>');
     * // <div id="container"><span>Start</span>Hello</div>
     *
     * @example
     * container.insertAdjacentHTML('beforeend', '<span>End</span>');
     * // <div id="container">Hello<span>End</span></div>
     *
     * @example
     * container.insertAdjacentHTML('afterend', '<p>After</p>');
     * // <div id="container">Hello</div><p>After</p>
     */
    insertAdjacentHTML(position, html) {
        // Validate position
        const validPositions = ['beforebegin', 'afterbegin', 'beforeend', 'afterend'];
        if (!validPositions.includes(position)) {
            throw new Error(`Invalid position: ${position}. Must be one of: ${validPositions.join(', ')}`);
        }

        // Find parser from root node
        const root = this.#findRoot();
        const parser = root.parser;
        if (!parser || typeof parser.parse !== 'function') {
            throw new Error('Parser not found. Node tree must be created via parser.parse()');
        }

        // Parse HTML
        const parsedRoot = parser.parse(html);
        const nodesToInsert = parsedRoot.children.flat(); // Get all top-level nodes

        if (nodesToInsert.length === 0) {
            return this; // Nothing to insert
        }

        // Handle closing tags (redirect to opening tag)
        let targetNode = this;
        if (this.type === 'tag-close') {
            // Find matching opening tag (same logic as insertBefore)
            const closeIndex = this.parent.children.indexOf(this);
            if (closeIndex !== -1) {
                const openCandidate = this.parent.children[closeIndex - 1];
                if (openCandidate?.type === 'tag-open' && openCandidate.name === this.name) {
                    targetNode = openCandidate;
                }
            }
        }

        // Route based on position
        switch (position) {
            case 'beforebegin':
                if (!targetNode.parent) {
                    throw new Error('Cannot insert beforebegin on node with no parent');
                }
                targetNode.insertBefore(...nodesToInsert);
                break;

            case 'afterbegin':
                if (targetNode.type !== 'tag-open') {
                    throw new Error('afterbegin can only be used on element nodes');
                }
                if (VOID_ELEMS.includes(targetNode.name)) {
                    throw new Error('afterbegin cannot be used on void elements');
                }
                // Insert at start of children array
                for (let i = nodesToInsert.length - 1; i >= 0; i--) {
                    nodesToInsert[i].parent = targetNode;
                    targetNode.children.unshift(nodesToInsert[i]);
                }
                break;

            case 'beforeend':
                if (targetNode.type !== 'tag-open') {
                    throw new Error('beforeend can only be used on element nodes');
                }
                if (VOID_ELEMS.includes(targetNode.name)) {
                    throw new Error('beforeend cannot be used on void elements');
                }
                targetNode.appendChild(...nodesToInsert);
                break;

            case 'afterend':
                if (!targetNode.parent) {
                    throw new Error('Cannot insert afterend on node with no parent');
                }
                targetNode.insertAfter(...nodesToInsert);
                break;
        }

        return this;
    }

    /**
     * Checks if a node is a void element (self-closing tag with no closing tag).
     * @param {Node} node - The node to check
     * @returns {boolean} True if the node is a void element
     */
    #isVoidElement(node) {
        return node.type === 'tag-open' && VOID_ELEMS.includes(node.name);
    }

    /**
     * Gets the full HTML representation of this node including its own tags and children.
     * @alias toHtml
     * @param {boolean} [showComments=false] - Whether to include comments in the output
     * @returns {string} Full HTML representation of the node
     */
    outerHtml(showComments = false) {
        return this.toHtml(showComments);
    }

    /**
     * Returns the first node matching the given CSS selector.
     * @param {string} selector - CSS selector
     * @returns {Node|null} The first matching node or null if none found
     */
    querySelector(selector) {
        const results = this.querySelectorAll(selector);
        return results.length > 0 ? results[0] : null;
    }

    /**
     * Returns all nodes matching the given CSS selector.
     * @param {string} selector - CSS selector
     * @returns {Node[]} Array of matching nodes
     */
    querySelectorAll(selector) {
        // Handle multiple selectors (comma-separated)
        if (selector.includes(',')) {
            const selectors = selector.split(',').map((s) => { return s.trim(); });
            const results = [];

            for (const singleSelector of selectors) {
                const singleResults = this.#findMatchingNodes(singleSelector);
                // Merge results, avoiding duplicates
                for (const result of singleResults) {
                    if (!results.includes(result)) {
                        results.push(result);
                    }
                }
            }

            return results;
        }

        return this.#findMatchingNodes(selector);
    }

    /**
     * Removes this node from the tree.
     * @returns {Node} The removed node
     */
    remove() {
        if (this.parent) {
            const index = this.parent.children.indexOf(this);
            if (index !== -1) {
                // If this is an opening tag, check if the NEXT node is its closing tag
                if (this.type === 'tag-open' && index + 1 < this.parent.children.length) {
                    const nextSibling = this.parent.children[index + 1];
                    if (nextSibling.type === 'tag-close' && nextSibling.name === this.name) {
                        // Remove both tags in one operation
                        this.parent.children.splice(index, 2);
                        this.parent = null;
                        return this;
                    }
                }

                // If this is a closing tag, check if the PREVIOUS node is its opening tag
                if (this.type === 'tag-close' && index > 0) {
                    const prevSibling = this.parent.children[index - 1];
                    if (prevSibling.type === 'tag-open' && prevSibling.name === this.name) {
                        // Remove both tags in one operation
                        this.parent.children.splice(index - 1, 2);
                        this.parent = null;
                        return this;
                    }
                }

                // If no adjacent matching tag, just remove this node
                this.parent.children.splice(index, 1);
                this.parent = null;
            }
        }
        return this;
    }

    /**
     * Removes an attribute from the node.
     * @param {string} name - Attribute name to remove
     */
    removeAttribute(name) {
        delete this.attributes[name];
    }

    /**
     * Replaces this node with one or more new nodes.
     * Accepts individual nodes or arrays of nodes.
     *
     * If this node is an opening tag, both the opening and closing tags (and all content
     * between them) will be removed and replaced with the new nodes.
     *
     * @param {...(Node|Node[])} newNodes - The nodes to replace this node with
     * @returns {Node} This node for chaining
     * @throws {Error} If node has no parent or is not found in parent's children
     *
     * @example
     * // Replace old node with new node
     * oldNode.replaceWith(newNode);
     *
     * @example
     * // Replace with multiple nodes
     * oldNode.replaceWith(node1, node2, node3);
     */
    replaceWith(...newNodes) {
        if (!this.parent) {
            throw new Error('Cannot replace a node with no parent');
        }

        const flatNodes = newNodes.flat();

        const index = this.parent.children.indexOf(this);
        if (index === -1) {
            throw new Error('Node not found in parent\'s children');
        }

        const { parent } = this;
        const nodesToDelete = [this];
        let deleteCount = 1;

        // Special handling for tag-open nodes
        if (this.type === 'tag-open') {
            const closingTag = this.#findClosingTag(this);

            if (closingTag) {
                nodesToDelete.push(closingTag);
                deleteCount = 2;
            }

            // Collect all descendants to be deleted
            const descendants = this.#getAllDescendants(this);
            nodesToDelete.push(...descendants);
        }

        // EXTRACT ALL replacement nodes if they're in the tree
        // (This handles both the descendant case AND the sibling case)
        const extractedData = [];

        for (const newNode of flatNodes) {
            if (newNode.parent) {
            // Extract the node (and its closing tag if applicable)
                const extracted = this.#extractNode(newNode);
                extractedData.push(extracted);
            } else {
                extractedData.push({ opening: newNode, closing: null, whitespace: null, removedCount: 0 });
            }
        }

        // Remove this node (and closing tag if applicable) from parent
        parent.children.splice(index, deleteCount);

        // Insert new nodes at the same position
        let insertIndex = index;
        for (const extracted of extractedData) {
        // Insert whitespace if present
            if (extracted.whitespace) {
                extracted.whitespace.parent = parent;
                parent.children.splice(insertIndex, 0, extracted.whitespace);
                insertIndex += 1;
            }

            // Insert opening tag
            extracted.opening.parent = parent;
            parent.children.splice(insertIndex, 0, extracted.opening);
            insertIndex += 1;

            // Insert closing tag if present
            if (extracted.closing) {
                extracted.closing.parent = parent;
                parent.children.splice(insertIndex, 0, extracted.closing);
                insertIndex += 1;
            }
        }

        // Clear parent reference for garbage collection
        for (const node of nodesToDelete) {
            node.parent = null;
        }

        return this;
    }

    /**
     * Sets an attribute on the node.
     * @param {string} name - Attribute name
     * @param {string} value - Attribute value
     */
    setAttribute(name, value) {
        this.attributes[name] = value;
    }

    /**
     * Converts the node and its children to an HTML string.
     * @param {boolean} [showComments=false] - Whether to include comments in the output
     * @returns {string} HTML representation of the node
     */
    toHtml(showComments = false) {
        if (this.type === 'text') {
            // Keep all original text exactly as parsed, no trimming
            return this.content;
        }

        if (this.type === 'comment') {
            if (!showComments) {
                return '';
            }

            const commentType = this.commentType || 'html-comment';

            if (commentType === 'js-single-line') {
                return `//${this.content}`;
            } if (commentType === 'js-multi-line') {
                return `/*${this.content}*/`;
            }
            return `<!--${this.content}-->`;

        }

        if (this.type === 'tag-open') {
            const attrs = this.#getNodeAttributesString(this);
            let result = `<${this.name}${attrs}>`;

            // Handle style tags specially - convert CSS nodes back to CSS
            if (this.styleBlock && this.children.length > 0) {
                result += `\n${this.#cssTreeToString(this.children, 0)}`;
            } else {
                // Regular tags and script tags
                for (const child of this.children) {
                    result += child.toHtml(showComments);
                }
            }

            return result;
        }

        if (this.type === 'tag-close') {
            return `</${this.name}>`;
        }

        // Root node - just return children
        let result = '';
        for (const child of this.children) {
            result += child.toHtml(showComments);
        }
        return result;
    }

    /**
     * Converts the node to its HTML string representation.
     * @returns {string} HTML representation of the node
     */
    toString() {
        return this.toHtml(true);
    }

    /**
     * Updates an attribute by appending a value with an optional separator. If the attribute does
     * not exist, it is created.
     * @param {string} name - Attribute name
     * @param {string} value - Value to append
     * @param {string} [separator=' '] - Separator to use when appending
     */
    updateAttribute(name, value, separator = ' ') {
        if (!(name in this.attributes)) {
            this.attributes[name] = value;
            return;
        }
        const currentValue = this.attributes[name];
        if (!currentValue.split(separator).includes(value)) {
            this.attributes[name] = `${currentValue}${separator}${value}`;
        }
    }

    /**
     * Generates a visual representation of the DOM tree starting from this node.
     * @param {Object} [options] - Visualization options
     * @param {number} [options.contentPreviewLength=20] - Maximum length for content previews
     * @param {boolean} [options.returnString=false] - If true, returns the visualization as a string instead of logging
     * @param {boolean} [options.showAttributes=true] - Whether to show node attributes
     * @param {boolean} [options.showContent=true] - Whether to show text/comment content previews
     * @param {boolean} [options.showNodeNumber=false] - Whether to show node numbers
     * @param {boolean} [options.showNodeType=false] - Whether to show node types
     * @returns {string|undefined} String representation if returnString is true, otherwise undefined
     */
    visualize(options = {}) {
        // Define default options
        const defaultOptions = {
            contentPreviewLength: 20,
            returnString: false,
            showAttributes: true,
            showContent: true,
            showNodeNumber: false,
            showNodeType: false
        };

        // Merge defaults with provided options
        const mergedOptions = { ...defaultOptions, ...options };

        // Extract specific options
        const {
            contentPreviewLength,
            returnString,
            showAttributes,
            showContent,
            showNodeNumber,
            showNodeType
        } = mergedOptions;

        // Initialize output and counter
        let output = '';
        let globalCounter = 0;

        // Helper function to get a preview of content
        const getPreview = (content) => {
            if (!content || !showContent) return '';
            const trimmed = content.trim();
            if (!trimmed.length) return '';

            return trimmed.length > contentPreviewLength ?
                `: "${trimmed.substring(0, contentPreviewLength - 3)}..."` :
                `: "${trimmed}"`;
        };

        // Helper function to format attributes
        const formatAttributes = (attrs) => {
            if (!showAttributes || Object.keys(attrs).length === 0) return '';

            return ` ${Object.entries(attrs)
                // eslint-disable-next-line no-extra-parens
                .map(([k, v]) => { return (v === '__EMPVAL__' ? k : `${k}="${v}"`); })
                .join(' ')}`;
        };

        // Format the current node (which may or may not be the root)
        let nodeLabel = '';
        if (this.type === 'root') {
            nodeLabel = 'ROOT';
        } else if (this.type === 'text') {
            nodeLabel = `TEXT${getPreview(this.content)}`;
        } else if (this.type === 'comment') {
            const commentType = this.commentType ? ` (${this.commentType})` : '';
            nodeLabel = `COMMENT${commentType}${getPreview(this.content)}`;
        } else if (this.type === 'tag-open') {
            const attrs = formatAttributes(this.attributes);
            nodeLabel = `<${this.name}${attrs}>`;
        } else if (this.type === 'tag-close') {
            nodeLabel = `</${this.name}>`;
        }

        if (showNodeType) {
            nodeLabel += ` (${this.type}`;
            if (this.scriptBlock) {
                nodeLabel += ', script-block';
            }
            nodeLabel += ')';
        }
        if (showNodeNumber) {
            nodeLabel += ` [${globalCounter}]`;
            globalCounter += 1;
        }
        output += `${nodeLabel}\n`;

        // Process children of the root with proper indentation
        const { children } = this;
        for (let i = 0; i < children.length; i++) {
            const isLastChild = i === children.length - 1;
            const prefix = isLastChild ? '└── ' : '├── ';

            // Process each child with proper indentation
            buildChildTree(children[i], prefix, isLastChild, []);
        }

        // Function to build the tree for child nodes
        function buildChildTree(node, prefix, isLast, parentPrefixes) {
            // Create current line
            let nodeLabel = '';

            if (node.type === 'text') {
                nodeLabel = `TEXT${getPreview(node.content)}`;
            } else if (node.type === 'comment') {
                const commentType = node.commentType ? ` (${node.commentType})` : '';
                nodeLabel = `COMMENT${commentType}${getPreview(node.content)}`;
            } else if (node.type === 'tag-open') {
                const attrs = formatAttributes(node.attributes);
                nodeLabel = `<${node.name}${attrs}>`;
            } else if (node.type === 'tag-close') {
                nodeLabel = `</${node.name}>`;
            }

            // Add the current node to output
            output += `${parentPrefixes.join('')}${prefix}${nodeLabel}`;
            if (showNodeType) {
                output += ` (${node.type}`;
                if (node.scriptBlock) {
                    output += ', script-block';
                }
                output += ')';
            }
            if (showNodeNumber) {
                output += ` [${globalCounter}]`;
                globalCounter += 1;
            }
            output += '\n';

            // Process children
            if (node.children.length > 0) {
                // Next level indentation
                const nextIndent = isLast ? '    ' : '│   ';
                const newParentPrefixes = [...parentPrefixes, nextIndent];

                for (let i = 0; i < node.children.length; i++) {
                    const isLastChild = i === node.children.length - 1;
                    const childPrefix = isLastChild ? '└── ' : '├── ';

                    buildChildTree(node.children[i], childPrefix, isLastChild, newParentPrefixes);
                }
            }
        }

        if (returnString) {
            return output;
        }
        console.log(output);
    }

}

export { Node };
export default Node;
