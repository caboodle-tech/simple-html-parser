/* eslint-disable no-continue */

import { Node } from './node.js';

const REGEX = {
    atRuleName: /[a-zA-Z\-]/,
    whitespace: /\s/
};

const VERSION = '1.0.0';

/**
 * CSS Parser that converts CSS strings into a tree structure using Node objects.
 * Handles modern CSS features including:
 * - Nested selectors
 * - CSS variables (custom properties)
 * - At-rules (@media, @keyframes, @supports, @container, etc.)
 * - Comments (/* ... *​/)
 */
class CSSParser {

    /**
     * @type {string} The CSS content being parsed
     */
    #css = '';

    /**
     * @type {number} Length of the CSS string
     */
    #length = 0;

    /**
     * @type {number} Current position in the CSS string
     */
    #pos = 0;

    /**
     * Creates a new CSSParser instance.
     */
    constructor() {
        // Initialization happens in parse() method
    }

    /**
     * Parses a CSS string into a tree structure using Node objects.
     * @param {string} css - The CSS content to parse
     * @returns {Node} Root node containing the parsed CSS tree
     */
    parse(css) {
        this.#css = css;
        this.#pos = 0;
        this.#length = css.length;

        const root = new Node('css-root');

        while (this.#pos < this.#length) {
            this.#skipWhitespace();

            if (this.#pos >= this.#length) {
                break;
            }

            // Check for comments
            if (this.#peek() === '/' && this.#peek(1) === '*') {
                const comment = this.#parseComment();
                if (comment) {
                    root.appendChild(comment);
                }
                continue;
            }

            // Check for at-rules
            if (this.#peek() === '@') {
                const atRule = this.#parseAtRule(root);
                if (atRule) {
                    root.appendChild(atRule);
                }
                continue;
            }

            // Parse regular CSS rule
            const rule = this.#parseRule(root);
            if (rule) {
                root.appendChild(rule);
            }
        }

        return root;
    }

    /**
     * Gets the version of the CSSParser library.
     * @returns {string} Version string
     */
    version() {
        return `CSS Parser v${VERSION}`;
    }

    /**
     * Determines if the current position is at a nested rule or a declaration.
     * @returns {boolean} True if it's a nested rule, false if it's a declaration
     */
    #isNestedRule() {
        let tempPos = this.#pos;
        let depth = 0;
        let foundColon = false;
        let foundBrace = false;

        // Look ahead to see if we find a '{' before a ':'
        while (tempPos < this.#length) {
            const char = this.#css[tempPos];

            if (char === '(') {
                depth += 1;
            } else if (char === ')') {
                depth -= 1;
            } else if (depth === 0) {
                if (char === ':' && this.#css[tempPos + 1] !== ':') {
                    // Found a colon (but not ::pseudo-element)
                    foundColon = true;
                    break;
                } else if (char === '{') {
                    foundBrace = true;
                    break;
                } else if (char === ';' || char === '}') {
                    break;
                }
            }

            tempPos += 1;
        }

        // If we found a brace before a colon, it's a nested rule
        // If we found a colon, it's a declaration
        return foundBrace && !foundColon;
    }

    /**
     * Parses an at-rule (@media, @keyframes, @supports, etc.).
     * @param {Node} parent - Parent node
     * @returns {Node|null} At-rule node or null if parsing fails
     */
    #parseAtRule(parent) {
        if (this.#peek() !== '@') {
            return null;
        }

        this.#pos += 1; // Skip @

        // Get the at-rule name (e.g., 'media', 'keyframes', 'supports')
        const nameStart = this.#pos;
        while (this.#pos < this.#length && REGEX.atRuleName.test(this.#css[this.#pos])) {
            this.#pos += 1;
        }

        const name = this.#css.substring(nameStart, this.#pos);
        this.#skipWhitespace();

        const atRule = new Node('css-at-rule', name, {}, parent);
        atRule.cssName = name;

        // Special handling for @import, @charset, etc. (statement-style at-rules)
        if (name === 'import' || name === 'charset' || name === 'namespace') {
            // These don't have blocks, just read until semicolon
            const start = this.#pos;
            while (this.#pos < this.#length && this.#peek() !== ';') {
                this.#pos += 1;
            }
            atRule.cssParams = this.#css.substring(start, this.#pos).trim();
            if (this.#peek() === ';') {
                this.#pos += 1;
            }
            return atRule;
        }

        // Get parameters (e.g., media query conditions, keyframe name)
        const paramsStart = this.#pos;
        let depth = 0;
        let inParams = true;

        while (this.#pos < this.#length && inParams) {
            const char = this.#peek();

            if (char === '(') {
                depth += 1;
            } else if (char === ')') {
                depth -= 1;
            } else if (char === '{' && depth === 0) {
                inParams = false;
                break;
            }

            this.#pos += 1;
        }

        atRule.cssParams = this.#css.substring(paramsStart, this.#pos).trim();

        this.#skipWhitespace();

        // Parse the block content
        if (this.#peek() === '{') {
            this.#pos += 1; // Skip opening brace
            this.#parseBlock(atRule);
        }

        return atRule;
    }

    /**
     * Parses the content inside a CSS block (between braces).
     * Handles both declarations and nested rules.
     * @param {Node} rule - The rule node to populate
     */
    #parseBlock(rule) {
        while (this.#pos < this.#length) {
            this.#skipWhitespace();

            if (this.#pos >= this.#length) {
                break;
            }

            const char = this.#peek();

            // End of block
            if (char === '}') {
                this.#pos += 1;
                break;
            }

            // Check for comments
            if (char === '/' && this.#peek(1) === '*') {
                const comment = this.#parseComment();
                if (comment) {
                    rule.appendChild(comment);
                }
                continue;
            }

            // Check for nested at-rules
            if (char === '@') {
                const atRule = this.#parseAtRule(rule);
                if (atRule) {
                    rule.appendChild(atRule);
                }
                continue;
            }

            // Check if this is a nested rule or a declaration
            // Look ahead to determine which it is
            const isNestedRule = this.#isNestedRule();

            if (isNestedRule) {
                // Parse as nested rule
                const nestedRule = this.#parseRule(rule);
                if (nestedRule) {
                    rule.appendChild(nestedRule);
                }
            } else {
                // Parse as declaration
                this.#parseDeclaration(rule);
            }
        }
    }

    /**
     * Parses a CSS comment.
     * @returns {Node|null} Comment node or null if parsing fails
     */
    #parseComment() {
        if (this.#peek() !== '/' || this.#peek(1) !== '*') {
            return null;
        }

        this.#pos += 2; // Skip /*

        const start = this.#pos;
        let end = this.#css.indexOf('*/', this.#pos);

        if (end === -1) {
            // Unclosed comment, take until end of string
            end = this.#length;
            this.#pos = this.#length;
        } else {
            this.#pos = end + 2; // Skip */
        }

        const comment = new Node('comment');
        comment.content = this.#css.substring(start, end);
        comment.commentType = 'css';

        return comment;
    }

    /**
     * Parses a CSS declaration (property: value;).
     * @param {Node} rule - The rule node to add the declaration to
     */
    #parseDeclaration(rule) {
        // Parse property name
        const propStart = this.#pos;
        while (this.#pos < this.#length && this.#peek() !== ':' && this.#peek() !== '}') {
            this.#pos += 1;
        }

        const property = this.#css.substring(propStart, this.#pos).trim();

        if (this.#peek() !== ':') {
            // Invalid declaration, skip to next semicolon or brace
            while (this.#pos < this.#length && this.#peek() !== ';' && this.#peek() !== '}') {
                this.#pos += 1;
            }
            if (this.#peek() === ';') {
                this.#pos += 1;
            }
            return;
        }

        this.#pos += 1; // Skip colon
        this.#skipWhitespace();

        // Parse value
        const valueStart = this.#pos;
        let depth = 0;

        while (this.#pos < this.#length) {
            const char = this.#peek();

            if (char === '(') {
                depth += 1;
            } else if (char === ')') {
                depth -= 1;
            } else if (depth === 0 && (char === ';' || char === '}')) {
                break;
            }

            this.#pos += 1;
        }

        const value = this.#css.substring(valueStart, this.#pos).trim();

        // Initialize cssDeclarations if it doesn't exist
        if (!rule.cssDeclarations) {
            rule.cssDeclarations = {};
        }

        // Add declaration to rule
        if (property && value) {
            rule.cssDeclarations[property] = value;
        }

        // Skip semicolon if present
        if (this.#peek() === ';') {
            this.#pos += 1;
        }
    }

    /**
     * Parses a CSS rule (selector + declarations).
     * @param {Node} parent - Parent node
     * @returns {Node|null} Rule node or null if parsing fails
     */
    #parseRule(parent) {
        // Parse selector
        const selectorStart = this.#pos;
        let depth = 0;

        while (this.#pos < this.#length) {
            const char = this.#peek();

            // Track parentheses depth for pseudo-classes/functions
            if (char === '(') {
                depth += 1;
            } else if (char === ')') {
                depth -= 1;
            } else if (char === '{' && depth === 0) {
                break;
            }

            this.#pos += 1;
        }

        const selector = this.#css.substring(selectorStart, this.#pos).trim();

        if (!selector || this.#peek() !== '{') {
            return null;
        }

        const rule = new Node('css-rule', selector, {}, parent);
        rule.cssSelector = selector;
        rule.cssDeclarations = {};

        this.#pos += 1; // Skip opening brace
        this.#parseBlock(rule);

        return rule;
    }

    /**
     * Peeks at a character at the current position plus an offset.
     * @param {number} [offset=0] - Offset from current position
     * @returns {string} The character at the position, or empty string if out of bounds
     */
    #peek(offset = 0) {
        const pos = this.#pos + offset;
        return pos < this.#length ? this.#css[pos] : '';
    }

    /**
     * Skips whitespace characters at the current position.
     */
    #skipWhitespace() {
        while (this.#pos < this.#length && REGEX.whitespace.test(this.#css[this.#pos])) {
            this.#pos += 1;
        }
    }

}

export { CSSParser };
export default CSSParser;
