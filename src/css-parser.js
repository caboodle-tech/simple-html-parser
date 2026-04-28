/* eslint-disable no-continue */

import { Node } from './node.js';

const REGEX = {
    atRuleName: /[a-zA-Z\-]/,
    whitespace: /\s/
};

const VERSION = '1.1.0';

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
        let parenDepth = 0;
        let bracketDepth = 0;

        // Look ahead to see if the next top-level boundary is a block open.
        while (tempPos < this.#length) {
            const char = this.#css[tempPos];
            const nextChar = tempPos + 1 < this.#length ? this.#css[tempPos + 1] : '';

            if (char === '"' || char === '\'') {
                tempPos = this.#skipStringAt(tempPos, char);
                continue;
            }

            if (char === '/' && nextChar === '*') {
                tempPos = this.#skipCommentAt(tempPos);
                continue;
            }

            if (char === '(') {
                parenDepth += 1;
            } else if (char === ')') {
                parenDepth = Math.max(parenDepth - 1, 0);
            } else if (char === '[') {
                bracketDepth += 1;
            } else if (char === ']') {
                bracketDepth = Math.max(bracketDepth - 1, 0);
            } else if (parenDepth === 0 && bracketDepth === 0) {
                if (char === '{') {
                    return true;
                }
                if (char === ';' || char === '}') {
                    break;
                }
            }

            tempPos += 1;
        }

        return false;
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
        const atRule = new Node('css-at-rule', name, {}, parent);
        atRule.cssName = name;
        this.#skipWhitespace();

        const atRulePrelude = this.#readAtRulePrelude();
        atRule.cssParams = atRulePrelude.params;
        atRule.cssAtRuleForm = atRulePrelude.form;

        if (atRulePrelude.form === 'statement') {
            if (this.#peek() === ';') {
                this.#pos += 1;
            }
            return atRule;
        }

        if (this.#peek() === '{') {
            this.#pos += 1;
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
                } else {
                    this.#recoverToBoundary();
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
                } else {
                    this.#recoverToBoundary();
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
        let bracketDepth = 0;

        while (this.#pos < this.#length) {
            const char = this.#peek();
            const nextChar = this.#peek(1);

            if (char === '"' || char === '\'') {
                this.#pos = this.#skipStringAt(this.#pos, char);
                continue;
            }

            if (char === '/' && nextChar === '*') {
                this.#pos = this.#skipCommentAt(this.#pos);
                continue;
            }

            // Track parentheses depth for pseudo-classes/functions
            if (char === '(') {
                depth += 1;
            } else if (char === ')') {
                depth = Math.max(depth - 1, 0);
            } else if (char === '[') {
                bracketDepth += 1;
            } else if (char === ']') {
                bracketDepth = Math.max(bracketDepth - 1, 0);
            } else if (char === '{' && depth === 0 && bracketDepth === 0) {
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
     * Reads an at-rule prelude and detects statement or block form.
     * @returns {{ params: string, form: string }}
     */
    #readAtRulePrelude() {
        const start = this.#pos;
        let parenDepth = 0;
        let bracketDepth = 0;

        while (this.#pos < this.#length) {
            const char = this.#peek();
            const nextChar = this.#peek(1);

            if (char === '"' || char === '\'') {
                this.#pos = this.#skipStringAt(this.#pos, char);
                continue;
            }

            if (char === '/' && nextChar === '*') {
                this.#pos = this.#skipCommentAt(this.#pos);
                continue;
            }

            if (char === '(') {
                parenDepth += 1;
            } else if (char === ')') {
                parenDepth = Math.max(parenDepth - 1, 0);
            } else if (char === '[') {
                bracketDepth += 1;
            } else if (char === ']') {
                bracketDepth = Math.max(bracketDepth - 1, 0);
            } else if (parenDepth === 0 && bracketDepth === 0) {
                if (char === ';') {
                    return {
                        params: this.#css.substring(start, this.#pos).trim(),
                        form: 'statement'
                    };
                }
                if (char === '{') {
                    return {
                        params: this.#css.substring(start, this.#pos).trim(),
                        form: 'block'
                    };
                }
                if (char === '}') {
                    return {
                        params: this.#css.substring(start, this.#pos).trim(),
                        form: 'statement'
                    };
                }
            }

            this.#pos += 1;
        }

        return {
            params: this.#css.substring(start, this.#pos).trim(),
            form: 'statement'
        };
    }

    /**
     * Skips a quoted string while respecting escapes.
     * @param {number} start - Position of quote character
     * @param {string} quoteChar - Quote character used for the string
     * @returns {number} Position after the string
     */
    #skipStringAt(start, quoteChar) {
        let index = start + 1;
        while (index < this.#length) {
            const char = this.#css[index];
            if (char === '\\') {
                index += 2;
                continue;
            }
            if (char === quoteChar) {
                index += 1;
                break;
            }
            index += 1;
        }
        return index;
    }

    /**
     * Skips a block comment and returns the next index.
     * @param {number} start - Position of the initial slash
     * @returns {number} Position after comment end
     */
    #skipCommentAt(start) {
        const end = this.#css.indexOf('*/', start + 2);
        if (end === -1) {
            return this.#length;
        }
        return end + 2;
    }

    /**
     * Advances parser to the next safe boundary when a parse branch fails.
     */
    #recoverToBoundary() {
        while (this.#pos < this.#length) {
            const char = this.#peek();
            if (char === ';') {
                this.#pos += 1;
                return;
            }
            if (char === '}') {
                return;
            }
            this.#pos += 1;
        }
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
