/* eslint-disable no-continue */
import { CSSParser } from './css-parser.js';
import { Node } from './node.js';

const REGEX = {
    attributePattern: /([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|(\S+)))?/g,
    jsRegexContext: /[\(\[{,;=:&|!?]/,
    validTagName: /[a-zA-Z0-9_\-]/,
    whitespace: /\s+/
};

const VERSION = '1.4.0';

// eslint-disable-next-line max-len
const VOID_ELEMS = ['img', 'br', 'hr', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'param', 'source', 'track', 'wbr'];

/**
 * A module for parsing and manipulating HTML using a DOM-like interface.
 * @module SimpleHtmlParser
 */
class SimpleHtmlParser {

    /**
     * @type {string[]} Tags that are handled specially (content parsed as text)
     */
    #specialTags = [];

    /**
      * Creates a new parser instance.
      *
      * NOTE: The default special tags 'jhp' and 's_' are tags we hoped to support but are no longer
      * planning to implement. You can override this list as needed for similar custom tags or HTML
      * elements you want to treat as text blocks.
      *
      * @param {string[]} [specialTags=['jhp', 's_']] - Tags where content is treated as text
      */
    constructor(specialTags = ['jhp', 's_']) {
        this.#specialTags = specialTags;
    }

    /**
     * Gets the list of special tags.
     * @returns {string[]} Array of special tag names
     */
    getSpecialTags() {
        return [...this.#specialTags];
    }

    /**
     * Parses an HTML string into a tree of nodes.
     * @param {string} html - HTML string to parse
     * @returns {Node} Root node of the parsed tree
     */
    parse(html) {
        const root = new Node('root');
        root.parser = this; // Store parser reference for insertAdjacentHTML
        let currentNode = root;
        let pos = 0;

        while (pos < html.length) {
            // Check for comments first
            if (html[pos] === '<' && html.substring(pos, pos + 4) === '<!--') {
                const commentEnd = html.indexOf('-->', pos);
                if (commentEnd === -1) {
                    pos += 1;
                    continue;
                }

                const commentContent = html.substring(pos + 4, commentEnd);
                const commentNode = new Node('comment', '', {}, currentNode);
                commentNode.content = commentContent;
                commentNode.commentType = 'html-comment';
                currentNode.appendChild(commentNode);

                pos = commentEnd + 3;
                continue;
            }

            // Check for non-tags
            if (html[pos] === '<' && (
                html[pos + 1] === '<' ||
                html[pos + 1] === ' ' ||
                (html[pos + 1] !== '/' && html[pos + 1] !== '!' &&
                !REGEX.validTagName.test(html[pos + 1]))
            )) {
                const nextTagPos = html.indexOf('<', pos + 1);
                const textEnd = nextTagPos === -1 ? html.length : nextTagPos;

                const textNode = new Node('text');
                textNode.content = html.substring(pos, textEnd);
                currentNode.appendChild(textNode);

                pos = textEnd;
                continue;
            }

            // Opening tag
            if (html[pos] === '<' && html[pos + 1] !== '/') {
                const tagEnd = html.indexOf('>', pos);
                if (tagEnd === -1) {
                    pos += 1;
                    continue;
                }

                const tagContent = html.substring(pos + 1, tagEnd);
                const parts = tagContent.split(REGEX.whitespace);
                const tagName = parts[0];

                // Parse attributes
                const attributes = {};
                const attrPattern = REGEX.attributePattern;
                let match;

                const attrStr = tagContent.substring(tagName.length);
                let attrLength = 0;
                while ((match = attrPattern.exec(attrStr)) !== null) {
                    attrLength += 1;
                    const name = match[1];
                    const value = match[2] || match[3] || match[4] || '__EMPVAL__';
                    attributes[name] = value;
                }

                const node = new Node('tag-open', tagName, attributes, currentNode);
                currentNode.appendChild(node);

                // Handle style tags
                if (tagName === 'style') {
                    // Find closing </style>
                    const closeTag = `</${tagName}>`;
                    const closeTagPos = html.indexOf(closeTag, pos);

                    if (closeTagPos !== -1) {
                        // Mark this node as a style block
                        node.styleBlock = true;

                        // Extract CSS content within the style tags
                        const cssContent = html.substring(tagEnd + 1, closeTagPos);

                        // Parse CSS content
                        const cssParser = new CSSParser();
                        const cssTree = cssParser.parse(cssContent);

                        // Append CSS tree as children
                        node.children = cssTree.children;

                        // Update pos to continue after </style>
                        pos = closeTagPos + closeTag.length;

                        // Create and add the closing tag node
                        const closeNode = new Node('tag-close', tagName, {}, currentNode);
                        closeNode.styleBlock = true;

                        // Add the closing tag at the same level as the opening tag
                        currentNode.appendChild(closeNode);
                        continue;
                    }
                }

                // Handle special tags (script, custom tags)
                if (this.#specialTags.includes(tagName) && attrLength === 0) {
                    // Mark this node as a script block
                    node.scriptBlock = true;
                    const closeTag = `</${tagName}>`;
                    const closeTagPos = html.indexOf(closeTag, tagEnd);

                    if (closeTagPos !== -1) {
                        // Process content as a mix of comments and text

                        // Extract script content within the script tags
                        const scriptContent = html.substring(tagEnd + 1, closeTagPos);

                        // Parse JS comments with proper context awareness
                        const position = 0;
                        let inString = false;
                        let stringChar = '';
                        let inRegex = false;
                        let inComment = false;
                        let commentType = '';
                        let commentStart = -1;
                        let textStart = position;

                        for (let i = 0; i < scriptContent.length; i++) {
                            const char = scriptContent[i];
                            const nextChar = i < scriptContent.length - 1 ? scriptContent[i + 1] : '';
                            const prevChar = i > 0 ? scriptContent[i - 1] : '';

                            // Handle escape sequences
                            if (prevChar === '\\') {
                                continue;
                            }

                            // String handling
                            if (!inComment && !inRegex && (char === '"' || char === "'" || char === '`')) {
                                if (!inString) {
                                    inString = true;
                                    stringChar = char;
                                } else if (char === stringChar) {
                                    inString = false;
                                }
                                continue;
                            }

                            // Regex handling (simplified - real JS parsers do more)
                            if (!inComment && !inString && char === '/' && prevChar !== '*' &&
                                (i === 0 || REGEX.jsRegexContext.test(scriptContent[i - 1]))) {
                                inRegex = true;
                                continue;
                            }

                            if (inRegex && char === '/' && prevChar !== '\\') {
                                inRegex = false;
                                continue;
                            }

                            // Comment handling
                            if (!inString && !inRegex && !inComment) {
                                if (char === '/' && nextChar === '/') {
                                    // Found start of single line comment
                                    if (textStart < i) {
                                        // Add text node for content before comment
                                        const textNode = new Node('text');
                                        textNode.content = scriptContent.substring(textStart, i);
                                        node.appendChild(textNode);
                                    }
                                    inComment = true;
                                    commentType = 'js-single-line';
                                    commentStart = i + 2; // Skip the //
                                    i += 1; // Skip the next character
                                    continue;
                                } else if (char === '/' && nextChar === '*') {
                                    // Found start of multi-line comment
                                    if (textStart < i) {
                                        // Add text node for content before comment
                                        const textNode = new Node('text');
                                        textNode.content = scriptContent.substring(textStart, i);
                                        node.appendChild(textNode);
                                    }
                                    inComment = true;
                                    commentType = 'js-multi-line';
                                    commentStart = i + 2; // Skip the /*
                                    i += 1; // Skip the next character
                                    continue;
                                }
                            } else if (inComment) {
                                if (commentType === 'js-single-line' && char === '\n') {
                                    // End of single line comment
                                    const commentNode = new Node('comment', '', {}, node);
                                    commentNode.content = scriptContent.substring(commentStart, i);
                                    commentNode.commentType = commentType;
                                    node.appendChild(commentNode);

                                    inComment = false;
                                    textStart = i + 1; // Start new text after this line break
                                } else if (commentType === 'js-multi-line' && char === '*' && nextChar === '/') {
                                    // End of multi-line comment
                                    const commentNode = new Node('comment', '', {}, node);
                                    commentNode.content = scriptContent.substring(commentStart, i);
                                    commentNode.commentType = commentType;
                                    node.appendChild(commentNode);

                                    inComment = false;
                                    textStart = i + 2; // Start new text after the */
                                    i += 1; // Skip the next character
                                }
                            }
                        }

                        // Handle any remaining text or unclosed comment
                        if (inComment) {
                            // Unclosed comment
                            const commentNode = new Node('comment', '', {}, node);
                            commentNode.content = scriptContent.substring(commentStart);
                            commentNode.commentType = commentType;
                            node.appendChild(commentNode);
                        } else if (textStart < scriptContent.length) {
                            // Remaining text
                            const textNode = new Node('text');
                            textNode.content = scriptContent.substring(textStart);
                            node.appendChild(textNode);
                        }

                        // Create and add the closing tag node
                        const closeNode = new Node('tag-close', tagName, {}, currentNode);
                        closeNode.scriptBlock = true;

                        // Add the closing tag at the same level as the opening tag
                        currentNode.appendChild(closeNode);

                        // Update pos to continue after </tag> (</script>, </jhp>, etc.)
                        pos = closeTagPos + closeTag.length;
                        continue;
                    }
                }

                // Only change currentNode for non-void elements
                if (!VOID_ELEMS.includes(tagName)) {
                    currentNode = node;
                }
                pos = tagEnd + 1;
                continue;
            }

            // Closing tag
            if (html[pos] === '<' && html[pos + 1] === '/') {
                const tagEnd = html.indexOf('>', pos);
                if (tagEnd === -1) {
                    pos += 1;
                    continue;
                }

                const tagName = html.substring(pos + 2, tagEnd);

                // Create closing tag node
                const closeNode = new Node('tag-close', tagName);

                // Find the matching opening tag in the parent chain
                let parent = currentNode;
                let foundMatch = false;

                while (parent && parent.type !== 'root') {
                    if (parent.type === 'tag-open' && parent.name === tagName) {
                        // Add closing tag as a sibling to the matching opening tag
                        // (i.e., as a child of the opening tag's parent)
                        parent.parent.appendChild(closeNode);

                        // Move current node up to the parent
                        currentNode = parent.parent;
                        foundMatch = true;
                        break;
                    }
                    // eslint-disable-next-line prefer-destructuring
                    parent = parent.parent;
                }

                // If no matching opening tag found, just add to current node
                if (!foundMatch) {
                    currentNode.appendChild(closeNode);
                }

                pos = tagEnd + 1;
                continue;
            }

            // Plain text content
            const nextTagPos = html.indexOf('<', pos);
            const textEnd = nextTagPos === -1 ? html.length : nextTagPos;

            if (textEnd > pos) {
                const content = html.substring(pos, textEnd);
                const textNode = new Node('text');
                textNode.content = content;
                currentNode.appendChild(textNode);
            }

            pos = textEnd;
        }

        return root;
    }

    /**
     * Gets the version of the SimpleHtmlParser library.
     * @returns {string} Version string
     */
    version() {
        return `Simple Html Parser v${VERSION}`;
    }

}

export { CSSParser, Node, SimpleHtmlParser };
export default SimpleHtmlParser;
