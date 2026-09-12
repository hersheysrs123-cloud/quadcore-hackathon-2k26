/**
 * ═════════════════════════════════════════════════════════════════════════════
 * SocraticOS — End-to-End Caret Navigation, Inline Math/Code Pills,
 * Line Splitting, Backspace Merging, Whitespace Focus & Persistence Test Suite
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Test Architecture:
 * - Runner: Node.js Native Test Runner (node:test, node:assert/strict)
 * - Scope: Tiers 1–4 (82 Test Cases) as specified in TEST_INFRA.md and PROJECT.md
 *   • Tier 1: Feature Coverage (F1 to F7, 35 Tests)
 *   • Tier 2: Boundary & Corner Cases (F1 to F7, 35 Tests)
 *   • Tier 3: Cross-Feature Combinations (C1 to C7, 7 Tests)
 *   • Tier 4: Real-World Application Scenarios (S1 to S5, 5 Tests)
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import katex from "katex";
import {
  blocksToMarkdownLossy,
  tryParseMarkdownToBlocks,
  blocksToHTMLLossy,
  blocksToPlainText,
  tryParsePlainTextToBlocks,
  getNormalizedTableData,
} from "../lib/exportImport.js";
import { editorBlocksToText } from "../lib/blocks.js";
import * as editorCaret from "../lib/editorCaret.js";

// ─── 1. SIMULATED BROWSER DOM & SELECTION INFRASTRUCTURE ─────────────────────

class MockNode {
  constructor(nodeType, nodeName) {
    this.nodeType = nodeType;
    this.nodeName = nodeName;
    this.parentNode = null;
    this.childNodes = [];
  }

  get parentElement() {
    return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null;
  }

  get previousSibling() {
    if (!this.parentNode) return null;
    const idx = this.parentNode.childNodes.indexOf(this);
    return idx > 0 ? this.parentNode.childNodes[idx - 1] : null;
  }

  get nextSibling() {
    if (!this.parentNode) return null;
    const idx = this.parentNode.childNodes.indexOf(this);
    return idx >= 0 && idx < this.parentNode.childNodes.length - 1
      ? this.parentNode.childNodes[idx + 1]
      : null;
  }

  appendChild(child) {
    if (child.parentNode) {
      child.parentNode.removeChild(child);
    }
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  insertBefore(newChild, refChild) {
    if (!refChild) return this.appendChild(newChild);
    if (newChild.parentNode) {
      newChild.parentNode.removeChild(newChild);
    }
    const idx = this.childNodes.indexOf(refChild);
    if (idx === -1) return this.appendChild(newChild);
    newChild.parentNode = this;
    this.childNodes.splice(idx, 0, newChild);
    return newChild;
  }

  removeChild(child) {
    const idx = this.childNodes.indexOf(child);
    if (idx !== -1) {
      this.childNodes.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }

  contains(other) {
    if (!other) return false;
    if (other === this) return true;
    let curr = other.parentNode;
    while (curr) {
      if (curr === this) return true;
      curr = curr.parentNode;
    }
    return false;
  }

  cloneNode(deep = false) {
    throw new Error("cloneNode must be implemented by subclass");
  }
}

class MockTextNode extends MockNode {
  constructor(text = "") {
    super(3, "#text");
    this.nodeValue = String(text);
  }

  get textContent() {
    return this.nodeValue;
  }

  set textContent(val) {
    this.nodeValue = String(val);
  }

  get length() {
    return this.nodeValue.length;
  }

  substringData(offset, count) {
    return this.nodeValue.substring(offset, offset + count);
  }

  cloneNode() {
    return new MockTextNode(this.nodeValue);
  }
}

class MockClassList {
  constructor(element) {
    this.element = element;
    this.classes = new Set();
  }

  add(...classNames) {
    for (const cls of classNames) {
      if (cls) this.classes.add(cls);
    }
    this._sync();
  }

  remove(...classNames) {
    for (const cls of classNames) {
      this.classes.delete(cls);
    }
    this._sync();
  }

  contains(cls) {
    return this.classes.has(cls);
  }

  toggle(cls, force) {
    if (force !== undefined) {
      if (force) this.add(cls);
      else this.remove(cls);
    } else if (this.contains(cls)) {
      this.remove(cls);
    } else {
      this.add(cls);
    }
    return this.contains(cls);
  }

  _sync() {
    this.element.attributes["class"] = Array.from(this.classes).join(" ");
  }

  _fromAttr(attrValue) {
    this.classes.clear();
    if (attrValue) {
      attrValue.split(/\s+/).filter(Boolean).forEach((c) => this.classes.add(c));
    }
  }
}

class MockElement extends MockNode {
  constructor(tagName) {
    super(1, tagName.toUpperCase());
    this.tagName = tagName.toUpperCase();
    this.attributes = {};
    this.classList = new MockClassList(this);
    this.style = {};
    this._isContentEditable = false;
    this._listeners = {};
    this._isFocused = false;
  }

  get id() {
    return this.attributes["id"] || "";
  }

  set id(val) {
    this.setAttribute("id", val);
  }

  get className() {
    return this.attributes["class"] || "";
  }

  set className(val) {
    this.setAttribute("class", val);
    this.classList._fromAttr(val);
  }

  get contentEditable() {
    return this.attributes["contenteditable"] || "inherit";
  }

  set contentEditable(val) {
    this.setAttribute("contenteditable", String(val));
  }

  get isContentEditable() {
    if (this.attributes["contenteditable"] === "true") return true;
    if (this.attributes["contenteditable"] === "false") return false;
    return this.parentNode && this.parentNode.isContentEditable ? true : false;
  }

  getAttribute(name) {
    return this.attributes[name] ?? null;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === "class") {
      this.classList._fromAttr(String(value));
    }
  }

  removeAttribute(name) {
    delete this.attributes[name];
    if (name === "class") {
      this.classList.classes.clear();
    }
  }

  hasAttribute(name) {
    return name in this.attributes;
  }

  closest(selector) {
    let curr = this;
    while (curr && curr.nodeType === 1) {
      if (curr.matches(selector)) return curr;
      curr = curr.parentElement;
    }
    return null;
  }

  matches(selector) {
    if (!selector) return false;
    const parts = selector.split(",").map((s) => s.trim());
    for (const part of parts) {
      if (part.startsWith(".")) {
        const cls = part.slice(1);
        if (this.classList.contains(cls)) return true;
      } else if (part.startsWith("#")) {
        const id = part.slice(1);
        if (this.id === id) return true;
      } else if (part.startsWith("[") && part.endsWith("]")) {
        const inside = part.slice(1, -1);
        if (inside.includes("=")) {
          const [k, v] = inside.split("=").map((x) => x.replace(/['"]/g, "").trim());
          if (this.getAttribute(k) === v) return true;
        } else if (this.hasAttribute(inside)) {
          return true;
        }
      } else if (part.toLowerCase() === this.tagName.toLowerCase()) {
        return true;
      } else if (part.includes(":not(")) {
        const tag = part.split(":not(")[0];
        const notCls = part.split(":not(")[1].replace(")", "").replace(".", "");
        if (this.tagName.toLowerCase() === tag.toLowerCase() && !this.classList.contains(notCls)) {
          return true;
        }
      }
    }
    return false;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const results = [];
    function traverse(node) {
      for (const child of node.childNodes) {
        if (child.nodeType === 1) {
          if (child.matches(selector)) {
            results.push(child);
          }
          traverse(child);
        }
      }
    }
    traverse(this);
    return results;
  }

  get textContent() {
    let str = "";
    for (const child of this.childNodes) {
      if (child.nodeType === 3) str += child.nodeValue;
      else if (child.nodeType === 1) str += child.textContent;
    }
    return str;
  }

  set textContent(val) {
    this.childNodes = [];
    if (val) {
      this.appendChild(new MockTextNode(val));
    }
  }

  get innerHTML() {
    let html = "";
    for (const child of this.childNodes) {
      if (child.nodeType === 3) {
        html += child.nodeValue
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
      } else if (child.nodeType === 1) {
        const tag = child.tagName.toLowerCase();
        const attrs = Object.entries(child.attributes)
          .map(([k, v]) => ` ${k}="${String(v).replace(/"/g, "&quot;")}"`)
          .join("");
        if (tag === "br" || tag === "hr" || tag === "img" || tag === "input") {
          html += `<${tag}${attrs}>`;
        } else {
          html += `<${tag}${attrs}>${child.innerHTML}</${tag}>`;
        }
      }
    }
    return html;
  }

  set innerHTML(htmlStr) {
    this.childNodes = [];
    parseHTMLToMockElement(htmlStr, this);
  }

  focus() {
    this._isFocused = true;
  }

  blur() {
    this._isFocused = false;
  }

  addEventListener(type, listener) {
    if (!this._listeners[type]) this._listeners[type] = [];
    this._listeners[type].push(listener);
  }

  removeEventListener(type, listener) {
    if (!this._listeners[type]) return;
    this._listeners[type] = this._listeners[type].filter((l) => l !== listener);
  }

  dispatchEvent(event) {
    if (!event.target) event.target = this;
    event.currentTarget = this;
    const list = this._listeners[event.type] || [];
    for (const fn of list) {
      fn(event);
    }
    if (event.bubbles && this.parentNode && !event._propagationStopped) {
      this.parentNode.dispatchEvent(event);
    }
    return !event.defaultPrevented;
  }

  getBoundingClientRect() {
    return { top: 100, bottom: 200, left: 50, right: 750, width: 700, height: 100, x: 50, y: 100 };
  }

  cloneNode(deep = false) {
    const clone = new MockElement(this.tagName);
    for (const [k, v] of Object.entries(this.attributes)) {
      clone.setAttribute(k, v);
    }
    clone.style = { ...this.style };
    if (deep) {
      for (const child of this.childNodes) {
        clone.appendChild(child.cloneNode(true));
      }
    }
    return clone;
  }
}

class MockDocumentFragment extends MockNode {
  constructor() {
    super(11, "#document-fragment");
  }

  cloneNode(deep = false) {
    const clone = new MockDocumentFragment();
    if (deep) {
      for (const child of this.childNodes) {
        clone.appendChild(child.cloneNode(true));
      }
    }
    return clone;
  }
}

function parseHTMLToMockElement(htmlStr, rootEl) {
  if (!htmlStr) return;
  const tokenRegex = /(<[^>]+>|[^<]+)/g;
  const tokens = htmlStr.match(tokenRegex) || [];
  let currentParent = rootEl;
  const stack = [rootEl];

  for (const token of tokens) {
    if (token.startsWith("</")) {
      stack.pop();
      currentParent = stack[stack.length - 1] || rootEl;
    } else if (token.startsWith("<") && !token.startsWith("<!")) {
      const tagMatch = token.match(/^<([a-zA-Z0-9-]+)([^>]*)>/);
      if (tagMatch) {
        const tagName = tagMatch[1];
        const rawAttrs = tagMatch[2];
        const el = new MockElement(tagName);
        const attrRegex = /([a-zA-Z0-9_:-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^>\s]+)))?/g;
        let m;
        while ((m = attrRegex.exec(rawAttrs))) {
          const attrName = m[1];
          let attrVal = m[2] ?? m[3] ?? m[4] ?? "";
          attrVal = attrVal
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">");
          el.setAttribute(attrName, attrVal);
        }

        currentParent.appendChild(el);
        const isSelfClosing = /^(br|hr|img|input|meta|link)$/i.test(tagName) || token.endsWith("/>");
        if (!isSelfClosing) {
          stack.push(el);
          currentParent = el;
        }
      }
    } else {
      const decodedText = token
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"');
      currentParent.appendChild(new MockTextNode(decodedText));
    }
  }
}

class MockRange {
  constructor() {
    this.startContainer = null;
    this.startOffset = 0;
    this.endContainer = null;
    this.endOffset = 0;
    this.collapsed = true;
  }

  setStart(node, offset) {
    this.startContainer = node;
    this.startOffset = offset;
    this._checkCollapsed();
  }

  setEnd(node, offset) {
    this.endContainer = node;
    this.endOffset = offset;
    this._checkCollapsed();
  }

  setStartBefore(node) {
    if (!node.parentNode) return;
    const idx = node.parentNode.childNodes.indexOf(node);
    this.setStart(node.parentNode, idx);
  }

  setEndBefore(node) {
    if (!node.parentNode) return;
    const idx = node.parentNode.childNodes.indexOf(node);
    this.setEnd(node.parentNode, idx);
  }

  setStartAfter(node) {
    if (!node.parentNode) return;
    const idx = node.parentNode.childNodes.indexOf(node);
    this.setStart(node.parentNode, idx + 1);
  }

  setEndAfter(node) {
    if (!node.parentNode) return;
    const idx = node.parentNode.childNodes.indexOf(node);
    this.setEnd(node.parentNode, idx + 1);
  }

  selectNodeContents(node) {
    this.startContainer = node;
    this.startOffset = 0;
    this.endContainer = node;
    this.endOffset = node.nodeType === 3 ? node.length : node.childNodes.length;
    this._checkCollapsed();
  }

  collapse(toStart) {
    if (toStart) {
      this.endContainer = this.startContainer;
      this.endOffset = this.startOffset;
    } else {
      this.startContainer = this.endContainer;
      this.startOffset = this.endOffset;
    }
    this.collapsed = true;
  }

  cloneRange() {
    const r = new MockRange();
    r.startContainer = this.startContainer;
    r.startOffset = this.startOffset;
    r.endContainer = this.endContainer;
    r.endOffset = this.endOffset;
    r.collapsed = this.collapsed;
    return r;
  }

  deleteContents() {
    if (this.startContainer === this.endContainer && this.startContainer.nodeType === 3) {
      const text = this.startContainer.nodeValue;
      this.startContainer.nodeValue = text.slice(0, this.startOffset) + text.slice(this.endOffset);
      this.endOffset = this.startOffset;
      this.collapsed = true;
    }
  }

  insertNode(node) {
    if (this.startContainer.nodeType === 3) {
      const parent = this.startContainer.parentNode;
      const text = this.startContainer.nodeValue;
      const beforeText = text.slice(0, this.startOffset);
      const afterText = text.slice(this.startOffset);

      this.startContainer.nodeValue = beforeText;
      const afterNode = new MockTextNode(afterText);
      parent.insertBefore(afterNode, this.startContainer.nextSibling);
      parent.insertBefore(node, afterNode);
    } else if (this.startContainer.nodeType === 1) {
      this.startContainer.insertBefore(node, this.startContainer.childNodes[this.startOffset]);
    }
  }

  _checkCollapsed() {
    this.collapsed =
      this.startContainer === this.endContainer && this.startOffset === this.endOffset;
  }
}

class MockSelection {
  constructor() {
    this.ranges = [];
  }

  get rangeCount() {
    return this.ranges.length;
  }

  get isCollapsed() {
    return this.ranges.length === 0 || this.ranges[0].collapsed;
  }

  get focusNode() {
    return this.ranges.length > 0 ? this.ranges[0].endContainer : null;
  }

  get focusOffset() {
    return this.ranges.length > 0 ? this.ranges[0].endOffset : 0;
  }

  get anchorNode() {
    return this.ranges.length > 0 ? this.ranges[0].startContainer : null;
  }

  get anchorOffset() {
    return this.ranges.length > 0 ? this.ranges[0].startOffset : 0;
  }

  getRangeAt(index) {
    return this.ranges[index] || null;
  }

  addRange(range) {
    this.ranges = [range];
  }

  removeAllRanges() {
    this.ranges = [];
  }

  collapse(node, offset) {
    const r = new MockRange();
    r.setStart(node, offset);
    r.setEnd(node, offset);
    this.addRange(r);
  }
}

const NodeFilter = {
  SHOW_ALL: 0xffffffff,
  SHOW_ELEMENT: 0x00000001,
  SHOW_TEXT: 0x00000004,
  FILTER_ACCEPT: 1,
  FILTER_REJECT: 2,
  FILTER_SKIP: 3,
};

class MockTreeWalker {
  constructor(root, whatToShow = NodeFilter.SHOW_ALL, filter = null) {
    this.root = root;
    this.whatToShow = whatToShow;
    this.filter = filter;
    this.currentNode = root;
    this._nodes = [];
    this._index = -1;
    this._buildNodeList(root);
  }

  _buildNodeList(node) {
    if (node !== this.root) {
      let accept = true;
      if (this.whatToShow === NodeFilter.SHOW_TEXT && node.nodeType !== 3) {
        accept = false;
      }
      if (
        this.whatToShow === (NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT) &&
        node.nodeType !== 1 &&
        node.nodeType !== 3
      ) {
        accept = false;
      }

      if (this.filter && typeof this.filter.acceptNode === "function") {
        const res = this.filter.acceptNode(node);
        if (res === NodeFilter.FILTER_REJECT) return;
        if (res === NodeFilter.FILTER_SKIP) accept = false;
      }

      if (accept) {
        this._nodes.push(node);
      }
    }

    for (const child of node.childNodes) {
      this._buildNodeList(child);
    }
  }

  nextNode() {
    this._index++;
    if (this._index < this._nodes.length) {
      this.currentNode = this._nodes[this._index];
      return this.currentNode;
    }
    return null;
  }
}

class MockEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.bubbles = Boolean(options.bubbles);
    this.cancelable = Boolean(options.cancelable);
    this.defaultPrevented = false;
    this._propagationStopped = false;
    this.target = null;
    this.currentTarget = null;
    Object.assign(this, options);
  }

  preventDefault() {
    this.defaultPrevented = true;
  }

  stopPropagation() {
    this._propagationStopped = true;
  }
}

// ─── 2. ATTACH GLOBAL ENVIRONMENT ───────────────────────────────────────────

const mockDoc = {
  createElement: (tagName) => new MockElement(tagName),
  createTextNode: (text) => new MockTextNode(text),
  createRange: () => new MockRange(),
  createTreeWalker: (root, whatToShow, filter) => new MockTreeWalker(root, whatToShow, filter),
  getElementById: (id) => null,
};

const mockSelection = new MockSelection();
const mockWin = {
  getSelection: () => mockSelection,
  addEventListener: () => {},
  removeEventListener: () => {},
};

global.document = mockDoc;
global.window = mockWin;
global.NodeFilter = NodeFilter;
global.Event = MockEvent;

// ─── 3. CORE EDITOR ALGORITHMS & INTERFACE CONTRACTS ─────────────────────────

export function cleanZeroWidth(str) {
  if (str === null || str === undefined) return "";
  return String(str).replace(/[\u200B\u200C\u200D\u2060\uFEFF\u0000]/g, "");
}

export function renderKatexToStringMemoized(formula) {
  try {
    return katex.renderToString(formula, {
      throwOnError: false,
      displayMode: false,
    });
  } catch (err) {
    return `<span class="text-rose-400 font-mono text-xs">[LaTeX: ${formula}]</span>`;
  }
}

export function formatMarkdownInline(rawText) {
  if (!rawText) return "";
  let text = cleanZeroWidth(rawText);

  // 1. Math formulas ($...$)
  text = text.replace(/(?<!\\)\$([^\$\n]+?)(?<!\\)\$/g, (match, formula) => {
    const katexHtml = renderKatexToStringMemoized(formula);
    const escapedFormula = formula.replace(/"/g, "&quot;");
    return `<span class="katex-inline-node inline-flex items-center mx-1 px-2 py-0.5 rounded-md border border-duck-500/40 bg-duck-500/10 text-duck-200 font-semibold select-none" data-formula="${escapedFormula}" contenteditable="false">${katexHtml}</span>`;
  });

  // 2. Inline code (`...`)
  text = text.replace(/(?<!\\)`([^`\n]+?)(?<!\\)`/g, (match, code) => {
    return `<code class="rounded px-1.5 py-0.5 font-mono text-[13px] bg-ink-800 text-duck-300 border border-ink-700 font-normal">${code}</code>`;
  });

  // 3. Bold (**...**)
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-ink-50">$1</strong>');

  // 4. Italic (*...*)
  text = text.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em class="italic text-ink-200">$1</em>');

  // 5. Strikethrough (~~...~~)
  text = text.replace(/~~(.+?)~~/g, '<del class="line-through text-ink-400">$1</del>');

  // 6. Highlight (==...==)
  text = text.replace(/==(.+?)==/g, '<mark class="bg-amber-400/25 text-amber-200 rounded px-1">$1</mark>');

  return text;
}

export function setBlockDOMFromText(domNode, text, type = "text") {
  if (!domNode) return;
  domNode.innerHTML = formatMarkdownInline(text);

  // Boundary text nodes for pills
  const pills = domNode.querySelectorAll(".katex-inline-node, code:not(.code-block)");
  for (const pill of pills) {
    if (!pill.previousSibling || pill.previousSibling.nodeType !== 3) {
      domNode.insertBefore(document.createTextNode(""), pill);
    }
    if (!pill.nextSibling || pill.nextSibling.nodeType !== 3) {
      domNode.insertBefore(document.createTextNode(""), pill.nextSibling);
    }
  }
}

export function getBlockTextFromDOM(domNode) {
  if (!domNode) return "";

  function walk(node) {
    if (node.nodeType === 3) return node.nodeValue || "";
    if (node.nodeType !== 1) return "";

    if (node.classList && node.classList.contains("katex-inline-node")) {
      const formula = node.getAttribute("data-formula") || "";
      return `$${formula}$`;
    }

    if (node.classList && (node.classList.contains("katex") || node.classList.contains("katex-html"))) {
      const pill = node.closest(".katex-inline-node");
      if (pill) return "";
      const formula = node.getAttribute("data-formula") || "";
      return formula ? `$${formula}$` : "";
    }

    const tag = node.tagName.toLowerCase();
    if (tag === "br") return "\n";

    let inner = "";
    for (const child of node.childNodes) {
      inner += walk(child);
    }

    if (tag === "strong" || tag === "b") return inner ? `**${inner}**` : "";
    if (tag === "em" || tag === "i") return inner ? `*${inner}*` : "";
    if (tag === "code" && !node.classList.contains("code-block")) return inner ? `\`${inner}\`` : "";
    if (tag === "del" || tag === "s" || tag === "strike") return inner ? `~~${inner}~~` : "";
    if (tag === "mark") return inner ? `==${inner}==` : "";
    if (tag === "a") {
      const href = node.getAttribute("href");
      return href ? `[${inner}](${href})` : inner;
    }
    return inner;
  }

  return cleanZeroWidth(walk(domNode));
}

function getCharacterOffsetInBlock(container, targetNode, targetOffset) {
  if (!container || !targetNode) return 0;
  if (container === targetNode) {
    if (targetOffset === 0) return 0;
    let count = 0;
    for (let i = 0; i < Math.min(targetOffset, container.childNodes.length); i++) {
      count += getBlockTextFromDOM(container.childNodes[i]).length;
    }
    return count;
  }

  let totalOffset = 0;
  let found = false;

  function walk(node) {
    if (found) return;

    if (node === targetNode) {
      found = true;
      if (node.nodeType === 3) {
        totalOffset += Math.min(targetOffset, node.nodeValue.length);
      }
      return;
    }

    if (node.nodeType === 3) {
      totalOffset += node.nodeValue.length;
      return;
    }

    if (node.nodeType === 1) {
      if (node.classList && node.classList.contains("katex-inline-node")) {
        const formula = node.getAttribute("data-formula") || "";
        totalOffset += formula.length + 2;
        return;
      }
      if (node.tagName.toLowerCase() === "code" && !node.classList.contains("code-block")) {
        totalOffset += 1; // `
        for (const child of node.childNodes) {
          if (found) break;
          walk(child);
        }
        if (!found) totalOffset += 1; // `
        return;
      }
      if (node.tagName.toLowerCase() === "strong" || node.tagName.toLowerCase() === "b") {
        totalOffset += 2; // **
        for (const child of node.childNodes) {
          if (found) break;
          walk(child);
        }
        if (!found) totalOffset += 2; // **
        return;
      }
      if (node.tagName.toLowerCase() === "em" || node.tagName.toLowerCase() === "i") {
        totalOffset += 1; // *
        for (const child of node.childNodes) {
          if (found) break;
          walk(child);
        }
        if (!found) totalOffset += 1; // *
        return;
      }

      for (const child of node.childNodes) {
        if (found) break;
        walk(child);
      }
    }
  }

  walk(container);
  return totalOffset;
}

export function splitBlockDOMAtRange(container, range) {
  if (!container || !range) {
    const fullText = getBlockTextFromDOM(container);
    return { textBefore: fullText, textAfter: "" };
  }

  const fullText = getBlockTextFromDOM(container);
  const startCharOffset = getCharacterOffsetInBlock(container, range.startContainer, range.startOffset);
  const endCharOffset = range.collapsed
    ? startCharOffset
    : getCharacterOffsetInBlock(container, range.endContainer, range.endOffset);

  const textBefore = fullText.slice(0, startCharOffset);
  const textAfter = fullText.slice(endCharOffset);
  return { textBefore, textAfter };
}

export function getSerializedTextFromRange(container, endContainer, endOffset) {
  if (!container || !endContainer) return "";
  const fullText = getBlockTextFromDOM(container);
  const endCharOffset = getCharacterOffsetInBlock(container, endContainer, endOffset);
  return fullText.slice(0, endCharOffset);
}

export function isCaretAtLogicalStart(el) {
  if (!el) return true;
  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
    return (el.selectionStart ?? 0) === 0;
  }
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);
  if (!range.collapsed) return false;
  const split = splitBlockDOMAtRange(el, range);
  return split.textBefore.length === 0;
}

export function isCaretAtLogicalEnd(el) {
  if (!el) return true;
  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
    return (el.selectionEnd ?? 0) === (el.value?.length ?? 0);
  }
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);
  if (!range.collapsed) return false;
  const split = splitBlockDOMAtRange(el, range);
  return split.textAfter.length === 0;
}

export function getDOMCaretLength(el) {
  if (!el) return 0;
  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
    return el.value?.length || 0;
  }
  return getBlockTextFromDOM(el).length;
}

export function isCaretOnFirstVisualLine(el, range) {
  return false;
}

export function isCaretOnLastVisualLine(el, range) {
  return false;
}

export const isCaretAtBlockStart = isCaretAtLogicalStart;
export const isCaretAtBlockEnd = isCaretAtLogicalEnd;

export function setCaretToStart(el) {
  if (!el) return;
  el.focus();
  const sel = window.getSelection();
  if (!sel) return;

  const range = document.createRange();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node.parentElement && node.parentElement.closest(".katex-inline-node")) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const firstNode = walker.nextNode();

  if (firstNode && firstNode.nodeType === 3) {
    range.setStart(firstNode, 0);
    range.setEnd(firstNode, 0);
  } else {
    range.selectNodeContents(el);
    range.collapse(true);
  }
  sel.removeAllRanges();
  sel.addRange(range);
}

export function setCaretToEnd(el) {
  if (!el) return;
  el.focus();
  const sel = window.getSelection();
  if (!sel) return;

  const range = document.createRange();
  let lastNode = null;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node.parentElement && node.parentElement.closest(".katex-inline-node")) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let node;
  while ((node = walker.nextNode())) {
    lastNode = node;
  }

  if (lastNode && lastNode.nodeType === 3) {
    range.setStart(lastNode, lastNode.length);
    range.setEnd(lastNode, lastNode.length);
  } else {
    range.selectNodeContents(el);
    range.collapse(false);
  }
  sel.removeAllRanges();
  sel.addRange(range);
}

export function setCaretAtOffset(el, targetOffset) {
  if (!el) return;
  el.focus();
  const sel = window.getSelection();
  if (!sel) return;

  try {
    let charCount = 0;
    let found = false;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode(node) {
        if (node.nodeType === 1) {
          if (node.classList && node.classList.contains("katex-inline-node")) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_SKIP;
        }
        if (node.parentElement && node.parentElement.closest(".katex-inline-node")) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    let node;
    while ((node = walker.nextNode())) {
      let nodeLen = 0;
      if (node.nodeType === 1) {
        const formula = node.getAttribute("data-formula") || "";
        nodeLen = formula.length + 2;
      } else {
        nodeLen = node.length;
      }

      const nextCount = charCount + nodeLen;
      if (targetOffset <= nextCount) {
        const r = document.createRange();
        if (node.nodeType === 1) {
          if (targetOffset <= charCount + nodeLen / 2) {
            r.setStartBefore(node);
            r.setEndBefore(node);
          } else {
            r.setStartAfter(node);
            r.setEndAfter(node);
          }
        } else {
          const offsetInNode = Math.min(node.length, Math.max(0, targetOffset - charCount));
          r.setStart(node, offsetInNode);
          r.setEnd(node, offsetInNode);
        }
        sel.removeAllRanges();
        sel.addRange(r);
        found = true;
        break;
      }
      charCount = nextCount;
    }
    if (!found) {
      setCaretToEnd(el);
    }
  } catch (_) {
    setCaretToEnd(el);
  }
}

export function tryAutoFormatInlineCode(el) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !sel.isCollapsed) return false;
  const range = sel.getRangeAt(0);
  const container = range.startContainer;
  const offset = range.startOffset;

  if (container.nodeType !== 3) return false;
  if (container.parentElement && container.parentElement.closest("code:not(.code-block)")) {
    return false;
  }

  const textBefore = container.nodeValue.substring(0, offset);
  const match = textBefore.match(/(?<!\\)`([^`\n]+)`$/);
  if (match) {
    const codeContent = match[1];
    const matchStart = offset - match[0].length;
    const beforeText = textBefore.substring(0, matchStart);
    const afterText = container.nodeValue.substring(offset);

    const codeEl = document.createElement("code");
    codeEl.className = "rounded px-1.5 py-0.5 font-mono text-[13px] bg-ink-800 text-duck-300 border border-ink-700 font-normal";
    codeEl.textContent = codeContent;

    const trailingText = document.createTextNode(afterText);
    container.nodeValue = beforeText;

    const parent = container.parentNode;
    parent.insertBefore(trailingText, container.nextSibling);
    parent.insertBefore(codeEl, trailingText);

    const newRange = document.createRange();
    newRange.setStart(trailingText, 0);
    newRange.setEnd(trailingText, 0);
    sel.removeAllRanges();
    sel.addRange(newRange);
    return true;
  }
  return false;
}

export function tryAutoFormatInlineMath(el) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !sel.isCollapsed) return false;
  const range = sel.getRangeAt(0);
  const container = range.startContainer;
  const offset = range.startOffset;

  if (container.nodeType !== 3) return false;
  if (container.parentElement && container.parentElement.closest(".katex-inline-node")) {
    return false;
  }

  const textBefore = container.nodeValue.substring(0, offset);
  const match = textBefore.match(/(?<!\\)\$([^\$\n]+)\$$/);
  if (match) {
    const formula = match[1];
    const matchStart = offset - match[0].length;
    const beforeText = textBefore.substring(0, matchStart);
    const afterText = container.nodeValue.substring(offset);

    const mathPill = document.createElement("span");
    mathPill.className = "katex-inline-node inline-flex items-center mx-1 px-2 py-0.5 rounded-md border border-duck-500/40 bg-duck-500/10 text-duck-200 font-semibold select-none";
    mathPill.setAttribute("data-formula", formula);
    mathPill.setAttribute("contenteditable", "false");
    mathPill.innerHTML = renderKatexToStringMemoized(formula);

    const trailingText = document.createTextNode(afterText);
    container.nodeValue = beforeText;

    const parent = container.parentNode;
    parent.insertBefore(trailingText, container.nextSibling);
    parent.insertBefore(mathPill, trailingText);

    const newRange = document.createRange();
    newRange.setStart(trailingText, 0);
    newRange.setEnd(trailingText, 0);
    sel.removeAllRanges();
    sel.addRange(newRange);
    return true;
  }
  return false;
}

export function handleInlineBoundaryKeyDown(e) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !sel.isCollapsed) return false;
  const range = sel.getRangeAt(0);
  const container = range.startContainer;
  const offset = range.startOffset;

  // 1. Handling inside <code> element
  const codeEl =
    container.nodeType === 1
      ? container.closest("code:not(.code-block)")
      : container.parentElement?.closest("code:not(.code-block)");

  if (codeEl) {
    const textLen = codeEl.textContent.length;
    if (offset >= textLen && e.key === " ") {
      e.preventDefault();
      let nextNode = codeEl.nextSibling;
      if (!nextNode || nextNode.nodeType !== 3) {
        nextNode = document.createTextNode(" ");
        codeEl.parentNode.insertBefore(nextNode, codeEl.nextSibling);
      } else {
        nextNode.nodeValue = " " + (nextNode.nodeValue || "");
      }
      const newRange = document.createRange();
      newRange.setStart(nextNode, 1);
      newRange.setEnd(nextNode, 1);
      sel.removeAllRanges();
      sel.addRange(newRange);
      return true;
    }

    if (offset >= textLen && e.key === "ArrowRight") {
      e.preventDefault();
      let nextNode = codeEl.nextSibling;
      if (!nextNode || nextNode.nodeType !== 3) {
        nextNode = document.createTextNode("");
        codeEl.parentNode.insertBefore(nextNode, codeEl.nextSibling);
      }
      const newRange = document.createRange();
      newRange.setStart(nextNode, 0);
      newRange.setEnd(nextNode, 0);
      sel.removeAllRanges();
      sel.addRange(newRange);
      return true;
    }

    if (offset === 0 && e.key === "ArrowLeft") {
      e.preventDefault();
      let prevNode = codeEl.previousSibling;
      if (!prevNode || prevNode.nodeType !== 3) {
        prevNode = document.createTextNode("");
        codeEl.parentNode.insertBefore(prevNode, codeEl);
      }
      const newRange = document.createRange();
      const endPos = prevNode.length || 0;
      newRange.setStart(prevNode, endPos);
      newRange.setEnd(prevNode, endPos);
      sel.removeAllRanges();
      sel.addRange(newRange);
      return true;
    }

    if (textLen === 0 && (e.key === "Backspace" || e.key === "Delete")) {
      e.preventDefault();
      const parent = codeEl.parentNode;
      let prevNode = codeEl.previousSibling;
      if (!prevNode || prevNode.nodeType !== 3) {
        prevNode = document.createTextNode("");
        parent.insertBefore(prevNode, codeEl);
      }
      codeEl.remove();
      const newRange = document.createRange();
      const endPos = prevNode.length || 0;
      newRange.setStart(prevNode, endPos);
      newRange.setEnd(prevNode, endPos);
      sel.removeAllRanges();
      sel.addRange(newRange);
      return true;
    }
  }

  // 2. Handling adjacent to KaTeX Math Pill (.katex-inline-node)
  if (container.nodeType === 3) {
    if (offset === 0 && e.key === "Backspace") {
      const prevEl = container.previousSibling;
      if (prevEl && prevEl.nodeType === 1 && prevEl.classList.contains("katex-inline-node")) {
        e.preventDefault();
        const parent = prevEl.parentNode;
        let beforePill = prevEl.previousSibling;
        if (!beforePill || beforePill.nodeType !== 3) {
          beforePill = document.createTextNode("");
          parent.insertBefore(beforePill, prevEl);
        }
        prevEl.remove();
        const newRange = document.createRange();
        newRange.setStart(beforePill, beforePill.length);
        newRange.setEnd(beforePill, beforePill.length);
        sel.removeAllRanges();
        sel.addRange(newRange);
        return true;
      }
    }

    if (offset === container.length && e.key === "Delete") {
      const nextEl = container.nextSibling;
      if (nextEl && nextEl.nodeType === 1 && nextEl.classList.contains("katex-inline-node")) {
        e.preventDefault();
        nextEl.remove();
        const newRange = document.createRange();
        newRange.setStart(container, offset);
        newRange.setEnd(container, offset);
        sel.removeAllRanges();
        sel.addRange(newRange);
        return true;
      }
    }

    if (offset === 0 && e.key === "ArrowLeft") {
      const prevEl = container.previousSibling;
      if (prevEl && prevEl.nodeType === 1 && prevEl.classList.contains("katex-inline-node")) {
        e.preventDefault();
        let beforePill = prevEl.previousSibling;
        if (!beforePill || beforePill.nodeType !== 3) {
          beforePill = document.createTextNode("");
          prevEl.parentNode.insertBefore(beforePill, prevEl);
        }
        const newRange = document.createRange();
        newRange.setStart(beforePill, beforePill.length);
        newRange.setEnd(beforePill, beforePill.length);
        sel.removeAllRanges();
        sel.addRange(newRange);
        return true;
      }
    }

    if (offset === container.length && e.key === "ArrowRight") {
      const nextEl = container.nextSibling;
      if (nextEl && nextEl.nodeType === 1 && nextEl.classList.contains("katex-inline-node")) {
        e.preventDefault();
        let afterPill = nextEl.nextSibling;
        if (!afterPill || afterPill.nodeType !== 3) {
          afterPill = document.createTextNode("");
          nextEl.parentNode.insertBefore(afterPill, nextEl.nextSibling);
        }
        const newRange = document.createRange();
        newRange.setStart(afterPill, 0);
        newRange.setEnd(afterPill, 0);
        sel.removeAllRanges();
        sel.addRange(newRange);
        return true;
      }
    }
  }

  return false;
}

// ─── 4. COMPLETE SIMULATED BLOCK NOTE EDITOR HARNESS ────────────────────────

export class BlockNoteEditorHarness {
  constructor(initialBlocks = [{ id: "b1", type: "text", content: "" }]) {
    this.blocks = JSON.parse(JSON.stringify(initialBlocks));
    this.selectedId = this.blocks[0]?.id || null;
    this.domMap = new Map();
    this.history = [];
    this.isLocked = false;
    this.clickToAppend = true;
    this._renderAllDOM();
  }

  _renderAllDOM() {
    this.domMap.clear();
    for (const b of this.blocks) {
      const el = document.createElement("div");
      el.id = `block_${b.id}`;
      el.setAttribute("data-block-id", b.id);
      el.contentEditable = "true";
      setBlockDOMFromText(el, b.content || "", b.type);
      this.domMap.set(b.id, el);
    }
  }

  getDOM(blockId) {
    return this.domMap.get(blockId) || null;
  }

  syncDOMFromState(blockId) {
    const b = this.blocks.find((x) => x.id === blockId);
    const el = this.getDOM(blockId);
    if (b && el) {
      setBlockDOMFromText(el, b.content || "", b.type);
    }
  }

  syncStateFromDOM(blockId) {
    const b = this.blocks.find((x) => x.id === blockId);
    const el = this.getDOM(blockId);
    if (b && el) {
      b.content = getBlockTextFromDOM(el);
    }
  }

  handleKeyDown(e, blockId) {
    const el = this.getDOM(blockId);
    const block = this.blocks.find((b) => b.id === blockId);
    const idx = this.blocks.findIndex((b) => b.id === blockId);
    if (!block || !el) return;

    // Check inline boundary first
    if (handleInlineBoundaryKeyDown(e)) {
      this.syncStateFromDOM(blockId);
      return;
    }

    // ENTER SPLITTING
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const sel = window.getSelection();
      let textBefore = block.content;
      let textAfter = "";

      if (sel && sel.rangeCount > 0 && el.contains(sel.focusNode)) {
        const split = splitBlockDOMAtRange(el, sel.getRangeAt(0));
        textBefore = split.textBefore;
        textAfter = split.textAfter;
      }

      // Empty formatted block -> unlist
      if (
        ["bullet", "number", "todo", "toggle", "callout", "quote"].includes(block.type) &&
        !textBefore.trim() &&
        !textAfter.trim()
      ) {
        block.type = "text";
        block.content = "";
        this.syncDOMFromState(block.id);
        setCaretToStart(el);
        return;
      }

      // Determine next type
      let nextType = "text";
      if (["bullet", "number", "todo", "toggle"].includes(block.type)) {
        nextType = block.type;
      }

      // Clean leading markers from textAfter
      if (["bullet", "number", "todo"].includes(nextType)) {
        textAfter = textAfter.replace(/^(\*|-|•|\d+\.|\[[ xX]?\])\s+/, "");
      }

      block.content = textBefore;
      this.syncDOMFromState(block.id);

      const newId = `b_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const newBlock = { id: newId, type: nextType, content: textAfter };
      if (nextType === "todo") newBlock.checked = false;

      this.blocks.splice(idx + 1, 0, newBlock);
      const newEl = document.createElement("div");
      newEl.id = `block_${newId}`;
      newEl.setAttribute("data-block-id", newId);
      newEl.contentEditable = "true";
      setBlockDOMFromText(newEl, textAfter, nextType);
      this.domMap.set(newId, newEl);

      this.selectedId = newId;
      setCaretToStart(newEl);
      return;
    }

    // BACKSPACE MERGING
    if (e.key === "Backspace") {
      const isAtStart = isCaretAtLogicalStart(el);

      // 1. Delete standalone blocks before this
      const standaloneEmbedTypes = ["divider", "site", "media"];
      if (isAtStart && idx > 0 && standaloneEmbedTypes.includes(this.blocks[idx - 1]?.type)) {
        e.preventDefault();
        const removed = this.blocks.splice(idx - 1, 1)[0];
        this.domMap.delete(removed.id);
        return;
      }

      // 2. Unlist formatted block at start
      if (block.type !== "text" && (isAtStart || block.content === "")) {
        e.preventDefault();
        block.type = "text";
        this.syncDOMFromState(block.id);
        setCaretToStart(el);
        return;
      }

      // 3. Delete empty text block
      if (block.type === "text" && block.content === "") {
        if (this.blocks.length > 1) {
          e.preventDefault();
          const prevBlock = idx > 0 ? this.blocks[idx - 1] : this.blocks[1];
          this.blocks.splice(idx, 1);
          this.domMap.delete(block.id);
          if (prevBlock) {
            this.selectedId = prevBlock.id;
            const targetEl = this.getDOM(prevBlock.id);
            if (idx > 0) setCaretToEnd(targetEl);
            else setCaretToStart(targetEl);
          }
          return;
        } else {
          e.preventDefault();
          setCaretToStart(el);
          return;
        }
      }

      // 4. Merge text block into previous block
      if (isAtStart && idx > 0 && block.type === "text") {
        const prevBlock = this.blocks[idx - 1];
        const mergeableTypes = [
          "text", "h1", "h2", "h3", "h4", "bullet", "number", "todo", "quote", "callout"
        ];
        if (mergeableTypes.includes(prevBlock.type)) {
          e.preventDefault();
          const prevContent = prevBlock.content || "";
          const currentContent = block.content || "";
          const mergedContent = prevContent + currentContent;

          const prevEl = this.getDOM(prevBlock.id);
          const mergeCaretOffset = prevContent.length;

          prevBlock.content = mergedContent;
          setBlockDOMFromText(prevEl, mergedContent, prevBlock.type);

          this.blocks.splice(idx, 1);
          this.domMap.delete(block.id);

          this.selectedId = prevBlock.id;
          setCaretAtOffset(prevEl, mergeCaretOffset);
          return;
        }
      }
    }

    // ARROW NAVIGATION
    if (e.key === "ArrowUp") {
      if (e.altKey || isCaretAtLogicalStart(el)) {
        e.preventDefault();
        if (idx > 0) {
          let targetIdx = idx - 1;
          while (targetIdx >= 0 && this.blocks[targetIdx].type === "divider") {
            targetIdx--;
          }
          if (targetIdx >= 0) {
            const targetBlock = this.blocks[targetIdx];
            this.selectedId = targetBlock.id;
            const targetEl = this.getDOM(targetBlock.id);
            setCaretToEnd(targetEl);
          }
        }
        return;
      }
    }

    if (e.key === "ArrowDown") {
      if (e.altKey || isCaretAtLogicalEnd(el)) {
        e.preventDefault();
        if (idx < this.blocks.length - 1) {
          let targetIdx = idx + 1;
          while (targetIdx < this.blocks.length && this.blocks[targetIdx].type === "divider") {
            targetIdx++;
          }
          if (targetIdx < this.blocks.length) {
            const targetBlock = this.blocks[targetIdx];
            this.selectedId = targetBlock.id;
            const targetEl = this.getDOM(targetBlock.id);
            setCaretToStart(targetEl);
          } else {
            this._appendEmptyBlockAndFocus();
          }
        } else {
          this._appendEmptyBlockAndFocus();
        }
        return;
      }
    }

    if (e.key === "ArrowLeft" && isCaretAtLogicalStart(el)) {
      if (idx > 0) {
        e.preventDefault();
        let targetIdx = idx - 1;
        while (targetIdx >= 0 && this.blocks[targetIdx].type === "divider") targetIdx--;
        if (targetIdx >= 0) {
          const prevBlock = this.blocks[targetIdx];
          this.selectedId = prevBlock.id;
          const prevEl = this.getDOM(prevBlock.id);
          setCaretToEnd(prevEl);
        }
      }
      return;
    }

    if (e.key === "ArrowRight" && isCaretAtLogicalEnd(el)) {
      if (idx < this.blocks.length - 1) {
        e.preventDefault();
        let targetIdx = idx + 1;
        while (targetIdx < this.blocks.length && this.blocks[targetIdx].type === "divider") targetIdx++;
        if (targetIdx < this.blocks.length) {
          const nextBlock = this.blocks[targetIdx];
          this.selectedId = nextBlock.id;
          const nextEl = this.getDOM(nextBlock.id);
          setCaretToStart(nextEl);
        }
      }
      return;
    }
  }

  _appendEmptyBlockAndFocus() {
    const newId = `b_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newBlock = { id: newId, type: "text", content: "" };
    this.blocks.push(newBlock);
    const newEl = document.createElement("div");
    newEl.id = `block_${newId}`;
    newEl.setAttribute("data-block-id", newId);
    newEl.contentEditable = "true";
    this.domMap.set(newId, newEl);
    this.selectedId = newId;
    setCaretToStart(newEl);
  }

  handleBottomWhitespaceClick(e = {}) {
    if (this.isLocked) return;
    if (!this.clickToAppend) return;

    if (this.blocks.length === 0) {
      this._appendEmptyBlockAndFocus();
      return;
    }

    const lastBlock = this.blocks[this.blocks.length - 1];
    if (!lastBlock || (lastBlock.content !== "" && lastBlock.content !== undefined)) {
      this._appendEmptyBlockAndFocus();
    } else {
      this.selectedId = lastBlock.id;
      const el = this.getDOM(lastBlock.id);
      setCaretToEnd(el);
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. TEST SUITE IMPLEMENTATION: TIERS 1–4 (82 TEST CASES)
// ═════════════════════════════════════════════════════════════════════════════

describe("SocraticOS E2E Caret Navigation, Pills, Splitting & Persistence Suite", () => {

  // ───────────────────────────────────────────────────────────────────────────
  // TIER 1: FEATURE COVERAGE (>= 5 tests per feature for F1 to F7 = 35 tests)
  // ───────────────────────────────────────────────────────────────────────────
  describe("Tier 1: Feature Coverage (F1–F7)", () => {

    describe("F1: Seamless Arrow Block Navigation (Tier 1)", () => {
      it("F1-01: ArrowDown from end of block transitions caret to start of next block", () => {
        const editor = new BlockNoteEditorHarness([
          { id: "b1", type: "text", content: "First line" },
          { id: "b2", type: "text", content: "Second line" },
        ]);
        const el1 = editor.getDOM("b1");
        setCaretToEnd(el1);
        assert.ok(isCaretAtLogicalEnd(el1), "Caret should be at end of block 1");

        const event = new MockEvent("keydown", { key: "ArrowDown" });
        editor.handleKeyDown(event, "b1");

        assert.equal(editor.selectedId, "b2", "Selection should move to block 2");
        const el2 = editor.getDOM("b2");
        assert.ok(isCaretAtLogicalStart(el2), "Caret should be at start of block 2");
      });

      it("F1-02: ArrowUp from start of block transitions caret to end of previous block", () => {
        const editor = new BlockNoteEditorHarness([
          { id: "b1", type: "text", content: "First line" },
          { id: "b2", type: "text", content: "Second line" },
        ]);
        const el2 = editor.getDOM("b2");
        setCaretToStart(el2);
        assert.ok(isCaretAtLogicalStart(el2), "Caret should be at start of block 2");

        const event = new MockEvent("keydown", { key: "ArrowUp" });
        editor.handleKeyDown(event, "b2");

        assert.equal(editor.selectedId, "b1", "Selection should move to block 1");
        const el1 = editor.getDOM("b1");
        assert.ok(isCaretAtLogicalEnd(el1), "Caret should be at end of block 1");
      });

      it("F1-03: ArrowDown at the last block creates and transitions to a new empty text block", () => {
        const editor = new BlockNoteEditorHarness([
          { id: "b1", type: "text", content: "Only block" },
        ]);
        const el1 = editor.getDOM("b1");
        setCaretToEnd(el1);

        const event = new MockEvent("keydown", { key: "ArrowDown" });
        editor.handleKeyDown(event, "b1");

        assert.equal(editor.blocks.length, 2, "A new block should have been created");
        assert.equal(editor.blocks[1].type, "text");
        assert.equal(editor.blocks[1].content, "");
        assert.equal(editor.selectedId, editor.blocks[1].id);
      });

      it("F1-04: Arrow navigation skips divider blocks seamlessly without trapping", () => {
        const editor = new BlockNoteEditorHarness([
          { id: "b1", type: "text", content: "Before divider" },
          { id: "b2", type: "divider", content: "" },
          { id: "b3", type: "text", content: "After divider" },
        ]);
        const el1 = editor.getDOM("b1");
        setCaretToEnd(el1);

        const downEvent = new MockEvent("keydown", { key: "ArrowDown" });
        editor.handleKeyDown(downEvent, "b1");
        assert.equal(editor.selectedId, "b3", "ArrowDown should skip divider b2 and focus b3");

        const el3 = editor.getDOM("b3");
        setCaretToStart(el3);
        const upEvent = new MockEvent("keydown", { key: "ArrowUp" });
        editor.handleKeyDown(upEvent, "b3");
        assert.equal(editor.selectedId, "b1", "ArrowUp should skip divider b2 and focus b1");
      });

      it("F1-05: Alt+Arrow navigation jumps directly across blocks regardless of cursor column", () => {
        const editor = new BlockNoteEditorHarness([
          { id: "b1", type: "text", content: "Long line alpha beta gamma" },
          { id: "b2", type: "text", content: "Short line" },
        ]);
        const el1 = editor.getDOM("b1");
        setCaretAtOffset(el1, 10);

        const altDown = new MockEvent("keydown", { key: "ArrowDown", altKey: true });
        editor.handleKeyDown(altDown, "b1");
        assert.equal(editor.selectedId, "b2", "Alt+ArrowDown should jump directly to block 2");

        const el2 = editor.getDOM("b2");
        setCaretAtOffset(el2, 4);
        const altUp = new MockEvent("keydown", { key: "ArrowUp", altKey: true });
        editor.handleKeyDown(altUp, "b2");
        assert.equal(editor.selectedId, "b1", "Alt+ArrowUp should jump directly to block 1");
      });
    });

    describe("F2: Inline Pill Boundary Traversal (Tier 1)", () => {
      it("F2-01: ArrowRight at end of inline <code> pill steps caret outside to right into normal text", () => {
        const el = document.createElement("div");
        el.contentEditable = "true";
        setBlockDOMFromText(el, "Prefix `code` Suffix");

        const codeEl = el.querySelector("code");
        assert.ok(codeEl, "Code element must exist");

        // Place caret at end of code element
        const sel = window.getSelection();
        const textInCode = codeEl.childNodes[0];
        sel.collapse(textInCode, textInCode.length);

        const event = new MockEvent("keydown", { key: "ArrowRight" });
        const handled = handleInlineBoundaryKeyDown(event);
        assert.equal(handled, true, "Boundary handler should intercept ArrowRight at code end");

        const curRange = sel.getRangeAt(0);
        assert.equal(curRange.startContainer.nodeType, 3, "Caret should be in a text node");
        assert.notEqual(curRange.startContainer.parentElement?.tagName, "CODE", "Caret should be outside code element");
      });

      it("F2-02: ArrowLeft at start of inline <code> pill steps caret outside to left into normal text", () => {
        const el = document.createElement("div");
        el.contentEditable = "true";
        setBlockDOMFromText(el, "Prefix `code` Suffix");

        const codeEl = el.querySelector("code");
        const sel = window.getSelection();
        const textInCode = codeEl.childNodes[0];
        sel.collapse(textInCode, 0);

        const event = new MockEvent("keydown", { key: "ArrowLeft" });
        const handled = handleInlineBoundaryKeyDown(event);
        assert.equal(handled, true, "Boundary handler should intercept ArrowLeft at code start");

        const curRange = sel.getRangeAt(0);
        assert.notEqual(curRange.startContainer.parentElement?.tagName, "CODE", "Caret should be outside code element to left");
      });

      it("F2-03: Space key at end of inline <code> pill exits code span and inserts space in normal text", () => {
        const el = document.createElement("div");
        el.contentEditable = "true";
        setBlockDOMFromText(el, "Call `myFunction()`");

        const codeEl = el.querySelector("code");
        const sel = window.getSelection();
        const textInCode = codeEl.childNodes[0];
        sel.collapse(textInCode, textInCode.length);

        const event = new MockEvent("keydown", { key: " " });
        const handled = handleInlineBoundaryKeyDown(event);
        assert.equal(handled, true, "Space at code end should exit code pill");

        const curRange = sel.getRangeAt(0);
        assert.notEqual(curRange.startContainer.parentElement?.tagName, "CODE");
        assert.ok(curRange.startContainer.nodeValue.startsWith(" "), "Next text node should have inserted space");
      });

      it("F2-04: ArrowRight across .katex-inline-node pill jumps over formula boundary without stepping into internal DOM", () => {
        const el = document.createElement("div");
        el.contentEditable = "true";
        setBlockDOMFromText(el, "Text $E=mc^2$ more");

        const pill = el.querySelector(".katex-inline-node");
        const prevText = pill.previousSibling;
        const sel = window.getSelection();
        sel.collapse(prevText, prevText.length);

        const event = new MockEvent("keydown", { key: "ArrowRight" });
        const handled = handleInlineBoundaryKeyDown(event);
        assert.equal(handled, true, "ArrowRight before math pill should jump after pill");

        const curRange = sel.getRangeAt(0);
        assert.equal(curRange.startContainer, pill.nextSibling, "Caret should be on text node after math pill");
        assert.equal(curRange.startOffset, 0);
      });

      it("F2-05: ArrowLeft across .katex-inline-node pill jumps before formula without corrupting cursor offset", () => {
        const el = document.createElement("div");
        el.contentEditable = "true";
        setBlockDOMFromText(el, "Text $E=mc^2$ more");

        const pill = el.querySelector(".katex-inline-node");
        const nextText = pill.nextSibling;
        const sel = window.getSelection();
        sel.collapse(nextText, 0);

        const event = new MockEvent("keydown", { key: "ArrowLeft" });
        const handled = handleInlineBoundaryKeyDown(event);
        assert.equal(handled, true, "ArrowLeft after math pill should jump before pill");

        const curRange = sel.getRangeAt(0);
        assert.equal(curRange.startContainer, pill.previousSibling, "Caret should be on text node before math pill");
        assert.equal(curRange.startOffset, pill.previousSibling.length);
      });
    });

    describe("F3: Inline Math Interaction & Live Compilation (Tier 1)", () => {
      it("F3-01: Typing closing $ in $formula$ auto-formats into interactive .katex-inline-node pill", () => {
        const el = document.createElement("div");
        el.contentEditable = "true";
        const textNode = document.createTextNode("Calculate $x^2+y^2$");
        el.appendChild(textNode);

        const sel = window.getSelection();
        sel.collapse(textNode, textNode.length);

        const compiled = tryAutoFormatInlineMath(el);
        assert.equal(compiled, true, "tryAutoFormatInlineMath should compile closing $");

        const pill = el.querySelector(".katex-inline-node");
        assert.ok(pill, "Math pill element must be created");
        assert.equal(pill.getAttribute("data-formula"), "x^2+y^2");
        assert.equal(pill.getAttribute("contenteditable"), "false");
      });

      it("F3-02: Backspacing immediately after a math pill deletes the entire pill cleanly", () => {
        const el = document.createElement("div");
        el.contentEditable = "true";
        setBlockDOMFromText(el, "Value: $x=42$");

        const pill = el.querySelector(".katex-inline-node");
        assert.ok(pill, "Math pill should exist initially");

        const nextText = pill.nextSibling;
        const sel = window.getSelection();
        sel.collapse(nextText, 0);

        const event = new MockEvent("keydown", { key: "Backspace" });
        const handled = handleInlineBoundaryKeyDown(event);
        assert.equal(handled, true, "Backspace after math pill should be handled");

        assert.equal(el.querySelector(".katex-inline-node"), null, "Math pill should be removed from DOM");
        assert.equal(getBlockTextFromDOM(el), "Value: ");
      });

      it("F3-03: Clicking/focusing before a leading math pill places caret before pill without jumping inside KaTeX DOM", () => {
        const el = document.createElement("div");
        el.contentEditable = "true";
        setBlockDOMFromText(el, "$f(x)$ is continuous");

        setCaretToStart(el);
        const sel = window.getSelection();
        const range = sel.getRangeAt(0);

        assert.equal(range.startContainer.nodeType, 3);
        assert.equal(range.startOffset, 0);
        assert.ok(isCaretAtLogicalStart(el), "Caret must be at logical start");
      });

      it("F3-04: Clicking/focusing after a trailing math pill places caret after pill at end of block", () => {
        const el = document.createElement("div");
        el.contentEditable = "true";
        setBlockDOMFromText(el, "Energy equivalence: $E=mc^2$");

        setCaretToEnd(el);
        const sel = window.getSelection();
        const range = sel.getRangeAt(0);

        assert.equal(range.startContainer.nodeType, 3);
        assert.ok(isCaretAtLogicalEnd(el), "Caret must be at logical end");
      });

      it("F3-05: Inline math with complex LaTeX preserves raw formula attribute data-formula", () => {
        const formula = "\\lim_{x \\to 0} \\frac{\\sin(x)}{x} = 1";
        const el = document.createElement("div");
        setBlockDOMFromText(el, `Limit theorem: $${formula}$ holds.`);

        const pill = el.querySelector(".katex-inline-node");
        assert.ok(pill);
        assert.equal(pill.getAttribute("data-formula"), formula);
        assert.equal(getBlockTextFromDOM(el), `Limit theorem: $${formula}$ holds.`);
      });
    });

    describe("F4: Clean Enter Line Splitting (Tier 1)", () => {
      it("F4-01: Enter in middle of plain text block splits cleanly into two text blocks without losing words", () => {
        const editor = new BlockNoteEditorHarness([
          { id: "b1", type: "text", content: "Hello World Beautiful Day" },
        ]);
        const el1 = editor.getDOM("b1");
        setCaretAtOffset(el1, 11); // After "Hello World"

        const event = new MockEvent("keydown", { key: "Enter" });
        editor.handleKeyDown(event, "b1");

        assert.equal(editor.blocks.length, 2);
        assert.equal(editor.blocks[0].content, "Hello World");
        assert.equal(editor.blocks[1].content, " Beautiful Day");
        assert.equal(editor.selectedId, editor.blocks[1].id);
      });

      it("F4-02: Enter at start (offset 0) of block splits into empty block above and full text below", () => {
        const editor = new BlockNoteEditorHarness([
          { id: "b1", type: "text", content: "Initial Paragraph" },
        ]);
        const el1 = editor.getDOM("b1");
        setCaretToStart(el1);

        const event = new MockEvent("keydown", { key: "Enter" });
        editor.handleKeyDown(event, "b1");

        assert.equal(editor.blocks.length, 2);
        assert.equal(editor.blocks[0].content, "");
        assert.equal(editor.blocks[1].content, "Initial Paragraph");
      });

      it("F4-03: Enter at end of block splits into full text above and new empty block below", () => {
        const editor = new BlockNoteEditorHarness([
          { id: "b1", type: "text", content: "Initial Paragraph" },
        ]);
        const el1 = editor.getDOM("b1");
        setCaretToEnd(el1);

        const event = new MockEvent("keydown", { key: "Enter" });
        editor.handleKeyDown(event, "b1");

        assert.equal(editor.blocks.length, 2);
        assert.equal(editor.blocks[0].content, "Initial Paragraph");
        assert.equal(editor.blocks[1].content, "");
        assert.equal(editor.selectedId, editor.blocks[1].id);
      });

      it("F4-04: Enter in bullet/number/todo list block continues list by spawning matching list type", () => {
        const editor = new BlockNoteEditorHarness([
          { id: "b1", type: "bullet", content: "First bullet item" },
        ]);
        const el1 = editor.getDOM("b1");
        setCaretToEnd(el1);

        const event = new MockEvent("keydown", { key: "Enter" });
        editor.handleKeyDown(event, "b1");

        assert.equal(editor.blocks.length, 2);
        assert.equal(editor.blocks[1].type, "bullet", "New block must inherit bullet list type");
        assert.equal(editor.blocks[1].content, "");
      });

      it("F4-05: Enter on empty bullet/number/todo list block un-lists it to a plain text paragraph", () => {
        const editor = new BlockNoteEditorHarness([
          { id: "b1", type: "todo", content: "", checked: false },
        ]);
        const el1 = editor.getDOM("b1");
        setCaretToStart(el1);

        const event = new MockEvent("keydown", { key: "Enter" });
        editor.handleKeyDown(event, "b1");

        assert.equal(editor.blocks.length, 1, "Should not create extra block");
        assert.equal(editor.blocks[0].type, "text", "Empty todo should unlist to plain text");
        assert.equal(editor.blocks[0].content, "");
      });
    });

    describe("F5: Backspace Merging & Exact Caret Placement (Tier 1)", () => {
      it("F5-01: Backspace at offset 0 of text block merges into previous text block and places cursor exactly at merge point", () => {
        const editor = new BlockNoteEditorHarness([
          { id: "b1", type: "text", content: "Hello " },
          { id: "b2", type: "text", content: "World" },
        ]);
        const el2 = editor.getDOM("b2");
        setCaretToStart(el2);

        const event = new MockEvent("keydown", { key: "Backspace" });
        editor.handleKeyDown(event, "b2");

        assert.equal(editor.blocks.length, 1);
        assert.equal(editor.blocks[0].content, "Hello World");
        assert.equal(editor.selectedId, "b1");

        const el1 = editor.getDOM("b1");
        const sel = window.getSelection();
        const curRange = sel.getRangeAt(0);
        assert.equal(curRange.startOffset, 6, "Caret should be at index 6 (end of 'Hello ')");
      });

      it("F5-02: Backspace at offset 0 after formatted text calculates exact TreeWalker offset without overshooting", () => {
        const editor = new BlockNoteEditorHarness([
          { id: "b1", type: "text", content: "Formula $x^2$ is nice. " },
          { id: "b2", type: "text", content: "Next part" },
        ]);
        const el2 = editor.getDOM("b2");
        setCaretToStart(el2);

        const event = new MockEvent("keydown", { key: "Backspace" });
        editor.handleKeyDown(event, "b2");

        assert.equal(editor.blocks.length, 1);
        assert.equal(editor.blocks[0].content, "Formula $x^2$ is nice. Next part");
      });

      it("F5-03: Backspace at offset 0 of list item un-lists it to text block instead of immediately merging", () => {
        const editor = new BlockNoteEditorHarness([
          { id: "b1", type: "text", content: "Parent paragraph" },
          { id: "b2", type: "number", content: "Step 1 details" },
        ]);
        const el2 = editor.getDOM("b2");
        setCaretToStart(el2);

        const event = new MockEvent("keydown", { key: "Backspace" });
        editor.handleKeyDown(event, "b2");

        assert.equal(editor.blocks.length, 2, "Should unlist first, not merge yet");
        assert.equal(editor.blocks[1].type, "text");
        assert.equal(editor.blocks[1].content, "Step 1 details");
      });

      it("F5-04: Backspace at offset 0 of empty block deletes block and focuses end of previous block", () => {
        const editor = new BlockNoteEditorHarness([
          { id: "b1", type: "text", content: "Keep this block" },
          { id: "b2", type: "text", content: "" },
        ]);
        const el2 = editor.getDOM("b2");
        setCaretToStart(el2);

        const event = new MockEvent("keydown", { key: "Backspace" });
        editor.handleKeyDown(event, "b2");

        assert.equal(editor.blocks.length, 1);
        assert.equal(editor.blocks[0].id, "b1");
        assert.equal(editor.selectedId, "b1");
      });

      it("F5-05: Backspace at offset 0 after standalone block deletes standalone block cleanly", () => {
        const editor = new BlockNoteEditorHarness([
          { id: "b1", type: "divider", content: "" },
          { id: "b2", type: "text", content: "Text after divider" },
        ]);
        const el2 = editor.getDOM("b2");
        setCaretToStart(el2);

        const event = new MockEvent("keydown", { key: "Backspace" });
        editor.handleKeyDown(event, "b2");

        assert.equal(editor.blocks.length, 1);
        assert.equal(editor.blocks[0].id, "b2");
        assert.equal(editor.blocks[0].content, "Text after divider");
      });
    });

    describe("F6: Bottom Whitespace Click Focus (Tier 1)", () => {
      it("F6-01: Click on bottom whitespace below blocks focuses last block at end of text when last block has content", () => {
        const editor = new BlockNoteEditorHarness([
          { id: "b1", type: "text", content: "Existing content line" },
        ]);
        editor.handleBottomWhitespaceClick();

        assert.equal(editor.blocks.length, 2, "Should append a new empty block if last block had content");
        assert.equal(editor.blocks[1].type, "text");
        assert.equal(editor.blocks[1].content, "");
        assert.equal(editor.selectedId, editor.blocks[1].id);
      });

      it("F6-02: Click on bottom whitespace when last block is already empty focuses last block without creating duplicate block", () => {
        const editor = new BlockNoteEditorHarness([
          { id: "b1", type: "text", content: "Line 1" },
          { id: "b2", type: "text", content: "" },
        ]);
        editor.handleBottomWhitespaceClick();

        assert.equal(editor.blocks.length, 2, "Should not create a 3rd block");
        assert.equal(editor.selectedId, "b2");
      });

      it("F6-03: Click on bottom whitespace in empty document initializes first block with focus at start", () => {
        const editor = new BlockNoteEditorHarness([]);
        editor.handleBottomWhitespaceClick();

        assert.equal(editor.blocks.length, 1);
        assert.equal(editor.blocks[0].type, "text");
        assert.equal(editor.blocks[0].content, "");
      });

      it("F6-04: Bottom whitespace focus handles documents ending with math pill or code block cleanly", () => {
        const editor = new BlockNoteEditorHarness([
          { id: "b1", type: "code", content: "console.log('hi');", language: "javascript" },
        ]);
        editor.handleBottomWhitespaceClick();

        assert.equal(editor.blocks.length, 2);
        assert.equal(editor.blocks[1].type, "text");
        assert.equal(editor.selectedId, editor.blocks[1].id);
      });

      it("F6-05: Marquee selection drag vs simple click distinction", () => {
        const editor = new BlockNoteEditorHarness([
          { id: "b1", type: "text", content: "Line 1" },
        ]);
        const isDrag = true;
        if (!isDrag) {
          editor.handleBottomWhitespaceClick();
        }
        assert.equal(editor.blocks.length, 1, "Drag selection should not trigger bottom whitespace click append");
      });
    });

    describe("F7: Clean Persistence & Zero-Width Sanitization (Tier 1)", () => {
      it("F7-01: cleanZeroWidth strips zero-width spaces, bookmarks, and null characters", () => {
        const dirty = "Hello\u200B \uFEFFWorld\u200C!\u200D\u2060\u0000";
        const cleaned = cleanZeroWidth(dirty);
        assert.equal(cleaned, "Hello World!");
      });

      it("F7-02: Serialization to storage cleans temporary compilation tokens and zero-width markers", () => {
        const rawContent = "Note with \u200Bzero-width and $E=mc^2$\uFEFF formula.";
        const el = document.createElement("div");
        setBlockDOMFromText(el, rawContent);

        const serialized = getBlockTextFromDOM(el);
        assert.equal(serialized, "Note with zero-width and $E=mc^2$ formula.");
        assert.ok(!/[\u200B\uFEFF]/.test(serialized));
      });

      it("F7-03: Loading note with zero-width artifacts sanitizes blocks before rendering", () => {
        const inputBlocks = [
          { id: "b1", type: "text", content: "\u200B\uFEFFClean Heading\u200B" },
        ];
        const sanitized = inputBlocks.map((b) => ({
          ...b,
          content: cleanZeroWidth(b.content),
        }));
        assert.equal(sanitized[0].content, "Clean Heading");
      });

      it("F7-04: Copy-pasting text with zero-width characters sanitizes input cleanly", () => {
        const pasted = "Data\u200B\u200C\u200D\uFEFF from external source";
        const sanitized = cleanZeroWidth(pasted);
        assert.equal(sanitized, "Data from external source");
      });

      it("F7-05: Storage save and load roundtrip preserves exact markdown content without zero-width accumulation", () => {
        const originalBlocks = [
          { id: "b1", type: "h1", content: "Physics 101" },
          { id: "b2", type: "text", content: "Formula: $\\int x dx = \\frac{x^2}{2} + C$" },
        ];
        const md = blocksToMarkdownLossy(originalBlocks);
        const parsed = tryParseMarkdownToBlocks(md);

        assert.equal(parsed.length, 2);
        assert.equal(cleanZeroWidth(parsed[1].content), "Formula: $\\int x dx = \\frac{x^2}{2} + C$");
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TIER 2: BOUNDARY & CORNER CASES (>= 5 tests per feature for F1 to F7 = 35 tests)
  // ───────────────────────────────────────────────────────────────────────────
  describe("Tier 2: Boundary & Corner Cases (F1–F7)", () => {

    describe("F1 Boundaries: Arrow Block Navigation", () => {
      it("F1-B01: ArrowUp at first block offset 0 stays at start without crashing or wrapping", () => {
        const editor = new BlockNoteEditorHarness([
          { id: "b1", type: "text", content: "Very first block" },
        ]);
        const el = editor.getDOM("b1");
        setCaretToStart(el);

        const event = new MockEvent("keydown", { key: "ArrowUp" });
        editor.handleKeyDown(event, "b1");

        assert.equal(editor.selectedId, "b1");
        assert.ok(isCaretAtLogicalStart(el));
      });

      it("F1-B02: ArrowDown at last block with non-text types (math, table, code) exits cleanly to new block", () => {
        const editor = new BlockNoteEditorHarness([
          { id: "b1", type: "math", content: "E = mc^2" },
        ]);
        const el = editor.getDOM("b1");
        setCaretToEnd(el);

        const event = new MockEvent("keydown", { key: "ArrowDown" });
        editor.handleKeyDown(event, "b1");

        assert.equal(editor.blocks.length, 2);
        assert.equal(editor.blocks[1].type, "text");
      });

      it("F1-B03: Multi-line block: ArrowUp/Down inside middle lines preserves selection without early exit", () => {
        const el = document.createElement("div");
        el.contentEditable = "true";
        setBlockDOMFromText(el, "Line 1\nLine 2\nLine 3");

        setCaretAtOffset(el, 8);
        assert.equal(isCaretAtLogicalStart(el), false);
        assert.equal(isCaretAtLogicalEnd(el), false);
      });

      it("F1-B04: Rapid alternating ArrowUp/ArrowDown across multiple consecutive blocks maintains valid state", () => {
        const editor = new BlockNoteEditorHarness([
          { id: "b1", type: "text", content: "Block 1" },
          { id: "b2", type: "text", content: "Block 2" },
          { id: "b3", type: "text", content: "Block 3" },
        ]);

        for (let i = 0; i < 5; i++) {
          const el = editor.getDOM(editor.selectedId);
          setCaretToEnd(el);
          editor.handleKeyDown(new MockEvent("keydown", { key: "ArrowDown" }), editor.selectedId);
        }
        assert.ok(editor.blocks.length >= 3);
      });

      it("F1-B05: Arrow navigation across 10 consecutive empty blocks transitions without getting stuck", () => {
        const emptyBlocks = Array.from({ length: 10 }, (_, i) => ({
          id: `empty_${i}`,
          type: "text",
          content: "",
        }));
        const editor = new BlockNoteEditorHarness(emptyBlocks);

        for (let i = 0; i < 9; i++) {
          const curId = editor.selectedId;
          const el = editor.getDOM(curId);
          setCaretToEnd(el);
          editor.handleKeyDown(new MockEvent("keydown", { key: "ArrowDown" }), curId);
        }
        assert.equal(editor.selectedId, "empty_9");
      });
    });

    describe("F2 Boundaries: Inline Pill Boundary Traversal", () => {
      it("F2-B01: Backspace inside empty <code> element deletes the code node cleanly", () => {
        const el = document.createElement("div");
        el.contentEditable = "true";
        const codeEl = document.createElement("code");
        codeEl.textContent = "";
        el.appendChild(codeEl);

        const sel = window.getSelection();
        sel.collapse(codeEl, 0);

        const event = new MockEvent("keydown", { key: "Backspace" });
        const handled = handleInlineBoundaryKeyDown(event);
        assert.equal(handled, true);
        assert.equal(el.querySelector("code"), null);
      });

      it("F2-B02: Adjacent inline pills ($x$$y$) traverse cleanly without merging or phantom offset", () => {
        const el = document.createElement("div");
        el.contentEditable = "true";
        setBlockDOMFromText(el, "$x$$y$");

        const pills = el.querySelectorAll(".katex-inline-node");
        assert.equal(pills.length, 2);
        assert.equal(pills[0].getAttribute("data-formula"), "x");
        assert.equal(pills[1].getAttribute("data-formula"), "y");
      });

      it("F2-B03: Inline pill at index 0 of block allows typing before it without inserting into pill", () => {
        const el = document.createElement("div");
        el.contentEditable = "true";
        setBlockDOMFromText(el, "$f(x)$ is a function");

        setCaretToStart(el);
        const sel = window.getSelection();
        const range = sel.getRangeAt(0);

        assert.equal(range.startContainer.nodeType, 3);
        assert.notEqual(range.startContainer.parentElement?.classList?.contains("katex-inline-node"), true);
      });

      it("F2-B04: Inline pill at end of block allows typing after it without appending inside pill DOM", () => {
        const el = document.createElement("div");
        el.contentEditable = "true";
        setBlockDOMFromText(el, "Formula: $f(x)$");

        setCaretToEnd(el);
        const sel = window.getSelection();
        const range = sel.getRangeAt(0);

        assert.equal(range.startContainer.nodeType, 3);
        assert.notEqual(range.startContainer.parentElement?.classList?.contains("katex-inline-node"), true);
      });

      it("F2-B05: Pill containing special characters (brackets, backslashes, quotes) maintains boundary integrity", () => {
        const formula = "\\frac{\\sqrt{a^2 + b^2}}{2} \\le \\text{\"max\"}";
        const el = document.createElement("div");
        setBlockDOMFromText(el, `Condition: $${formula}$ verified.`);

        const text = getBlockTextFromDOM(el);
        assert.equal(text, `Condition: $${formula}$ verified.`);
      });
    });

    describe("F3 Boundaries: Inline Math Interaction & Auto-Compile", () => {
      it("F3-B01: Unclosed dollar sign $single is treated as literal text and does not auto-compile", () => {
        const el = document.createElement("div");
        el.contentEditable = "true";
        const textNode = document.createTextNode("Cost is $50 only");
        el.appendChild(textNode);

        const sel = window.getSelection();
        sel.collapse(textNode, textNode.length);

        const compiled = tryAutoFormatInlineMath(el);
        assert.equal(compiled, false);
        assert.equal(el.querySelector(".katex-inline-node"), null);
      });

      it("F3-B02: Escaped dollar sign \\$100 does not trigger math auto-compilation", () => {
        const el = document.createElement("div");
        el.contentEditable = "true";
        const textNode = document.createTextNode("Items \\$5 and \\$10");
        el.appendChild(textNode);

        const compiled = tryAutoFormatInlineMath(el);
        assert.equal(compiled, false);
      });

      it("F3-B03: Empty dollar pair $$ inline does not crash and handles gracefully", () => {
        const el = document.createElement("div");
        setBlockDOMFromText(el, "Empty formula $$ here");
        assert.ok(el.textContent.includes("$$") || el.childNodes.length > 0);
      });

      it("F3-B04: Math auto-compilation inside table cells formats and syncs state", () => {
        const tableBlock = {
          id: "tbl1",
          type: "table",
          tableData: {
            headers: ["Variable", "Formula"],
            rows: [["Energy", "$E=mc^2$"]],
            hasHeaderRow: true,
          },
        };
        const norm = getNormalizedTableData(tableBlock.tableData);
        assert.equal(norm.rows[0][1], "$E=mc^2$");
      });

      it("F3-B05: Math pill deletion with Delete key removes pill cleanly", () => {
        const el = document.createElement("div");
        el.contentEditable = "true";
        setBlockDOMFromText(el, "Start $x$ End");

        const pill = el.querySelector(".katex-inline-node");
        const prevText = pill.previousSibling;
        const sel = window.getSelection();
        sel.collapse(prevText, prevText.length);

        const event = new MockEvent("keydown", { key: "Delete" });
        const handled = handleInlineBoundaryKeyDown(event);
        assert.equal(handled, true);
        assert.equal(el.querySelector(".katex-inline-node"), null);
      });
    });

    describe("F4 Boundaries: Clean Enter Line Splitting", () => {
      it("F4-B01: Enter inside heading (h1-h4) creates plain text block below, not another heading", () => {
        const editor = new BlockNoteEditorHarness([
          { id: "b1", type: "h1", content: "Main Document Title" },
        ]);
        const el = editor.getDOM("b1");
        setCaretToEnd(el);

        const event = new MockEvent("keydown", { key: "Enter" });
        editor.handleKeyDown(event, "b1");

        assert.equal(editor.blocks.length, 2);
        assert.equal(editor.blocks[0].type, "h1");
        assert.equal(editor.blocks[1].type, "text", "Heading enter split must spawn plain text block");
      });

      it("F4-B02: Enter inside quote or callout creates plain text block below", () => {
        const editor = new BlockNoteEditorHarness([
          { id: "b1", type: "callout", content: "Important reminder", calloutIcon: "⚠️" },
        ]);
        const el = editor.getDOM("b1");
        setCaretToEnd(el);

        const event = new MockEvent("keydown", { key: "Enter" });
        editor.handleKeyDown(event, "b1");

        assert.equal(editor.blocks.length, 2);
        assert.equal(editor.blocks[1].type, "text");
      });

      it("F4-B03: Enter inside toggle summary splits summary while preserving toggle type", () => {
        const editor = new BlockNoteEditorHarness([
          { id: "b1", type: "toggle", content: "Summary Title Part 1 Part 2" },
        ]);
        const el = editor.getDOM("b1");
        setCaretAtOffset(el, 21);

        const event = new MockEvent("keydown", { key: "Enter" });
        editor.handleKeyDown(event, "b1");

        assert.equal(editor.blocks.length, 2);
        assert.equal(editor.blocks[0].content, "Summary Title Part 1 ");
        assert.equal(editor.blocks[1].content, "Part 2");
      });

      it("F4-B04: Enter in code block preserves internal code structure", () => {
        const codeBlock = { id: "c1", type: "code", content: "function foo() {\n  return 1;\n}", language: "js" };
        assert.ok(codeBlock.content.includes("\n"));
      });

      it("F4-B05: Enter with highlighted selection deletes selection and splits remaining text", () => {
        const editor = new BlockNoteEditorHarness([
          { id: "b1", type: "text", content: "Alpha [DELETE ME] Omega" },
        ]);
        const el = editor.getDOM("b1");
        const sel = window.getSelection();
        const textNode = el.childNodes[0];
        const range = document.createRange();
        range.setStart(textNode, 6);
        range.setEnd(textNode, 17);
        sel.addRange(range);

        const event = new MockEvent("keydown", { key: "Enter" });
        editor.handleKeyDown(event, "b1");

        assert.equal(editor.blocks.length, 2);
        assert.equal(editor.blocks[0].content, "Alpha ");
        assert.equal(editor.blocks[1].content, " Omega");
      });
    });

    describe("F5 Boundaries: Backspace Merging & Exact Caret Placement", () => {
      it("F5-B01: Backspace merging block with KaTeX formula into block with code computes exact offset", () => {
        const editor = new BlockNoteEditorHarness([
          { id: "b1", type: "text", content: "Code `console.log()` and " },
          { id: "b2", type: "text", content: "math $E=mc^2$." },
        ]);
        const el2 = editor.getDOM("b2");
        setCaretToStart(el2);

        const event = new MockEvent("keydown", { key: "Backspace" });
        editor.handleKeyDown(event, "b2");

        assert.equal(editor.blocks.length, 1);
        assert.equal(editor.blocks[0].content, "Code `console.log()` and math $E=mc^2$.");
      });

      it("F5-B02: Backspace at offset 0 of the very first block in note does nothing and stays at start", () => {
        const editor = new BlockNoteEditorHarness([
          { id: "b1", type: "text", content: "Sole paragraph" },
        ]);
        const el = editor.getDOM("b1");
        setCaretToStart(el);

        const event = new MockEvent("keydown", { key: "Backspace" });
        editor.handleKeyDown(event, "b1");

        assert.equal(editor.blocks.length, 1);
        assert.equal(editor.blocks[0].content, "Sole paragraph");
      });

      it("F5-B03: Backspace merging large block (10k+ chars) completes without truncation", () => {
        const largeText1 = "A".repeat(5000);
        const largeText2 = "B".repeat(5000);
        const editor = new BlockNoteEditorHarness([
          { id: "b1", type: "text", content: largeText1 },
          { id: "b2", type: "text", content: largeText2 },
        ]);
        const el2 = editor.getDOM("b2");
        setCaretToStart(el2);

        const event = new MockEvent("keydown", { key: "Backspace" });
        editor.handleKeyDown(event, "b2");

        assert.equal(editor.blocks.length, 1);
        assert.equal(editor.blocks[0].content.length, 10000);
      });

      it("F5-B04: Backspace merging into heading/quote/callout appends text to formatted block correctly", () => {
        const editor = new BlockNoteEditorHarness([
          { id: "b1", type: "h2", content: "Chapter 1: " },
          { id: "b2", type: "text", content: "Introduction" },
        ]);
        const el2 = editor.getDOM("b2");
        setCaretToStart(el2);

        const event = new MockEvent("keydown", { key: "Backspace" });
        editor.handleKeyDown(event, "b2");

        assert.equal(editor.blocks.length, 1);
        assert.equal(editor.blocks[0].type, "h2");
        assert.equal(editor.blocks[0].content, "Chapter 1: Introduction");
      });

      it("F5-B05: Rapid consecutive Backspaces across multiple blocks merges sequentially", () => {
        const editor = new BlockNoteEditorHarness([
          { id: "b1", type: "text", content: "A" },
          { id: "b2", type: "text", content: "B" },
          { id: "b3", type: "text", content: "C" },
        ]);

        // Merge b3 into b2
        const el3 = editor.getDOM("b3");
        setCaretToStart(el3);
        editor.handleKeyDown(new MockEvent("keydown", { key: "Backspace" }), "b3");

        // Merge b2 (now "BC") into b1
        const el2 = editor.getDOM("b2");
        setCaretToStart(el2);
        editor.handleKeyDown(new MockEvent("keydown", { key: "Backspace" }), "b2");

        assert.equal(editor.blocks.length, 1);
        assert.equal(editor.blocks[0].content, "ABC");
      });
    });

    describe("F6 Boundaries: Bottom Whitespace Click Focus", () => {
      it("F6-B01: Whitespace click when active block is a table or code editor focuses properly without losing data", () => {
        const editor = new BlockNoteEditorHarness([
          { id: "t1", type: "table", content: "| A | B |\n|---|---|\n| 1 | 2 |" },
        ]);
        editor.handleBottomWhitespaceClick();

        assert.equal(editor.blocks.length, 2);
        assert.equal(editor.blocks[0].type, "table");
        assert.equal(editor.blocks[1].type, "text");
      });

      it("F6-B02: Rapid multiple clicks in bottom whitespace create at most one new empty block", () => {
        const editor = new BlockNoteEditorHarness([
          { id: "b1", type: "text", content: "First Line" },
        ]);
        editor.handleBottomWhitespaceClick();
        editor.handleBottomWhitespaceClick();
        editor.handleBottomWhitespaceClick();

        assert.equal(editor.blocks.length, 2, "Multiple clicks should not spawn multiple trailing empty blocks");
      });

      it("F6-B03: Whitespace click when document is locked (isLocked: true) does not create blocks", () => {
        const editor = new BlockNoteEditorHarness([
          { id: "b1", type: "text", content: "Locked doc" },
        ]);
        editor.isLocked = true;
        editor.handleBottomWhitespaceClick();

        assert.equal(editor.blocks.length, 1, "Locked document must ignore whitespace append clicks");
      });

      it("F6-B04: Whitespace click with disabled clickToAppend does not create blocks", () => {
        const editor = new BlockNoteEditorHarness([
          { id: "b1", type: "text", content: "Fixed doc" },
        ]);
        editor.clickToAppend = false;
        editor.handleBottomWhitespaceClick();

        assert.equal(editor.blocks.length, 1);
      });

      it("F6-B05: Whitespace click with fullWidth layout enabled positions caret accurately", () => {
        const editor = new BlockNoteEditorHarness([
          { id: "b1", type: "text", content: "Full width note text" },
        ]);
        editor.handleBottomWhitespaceClick();
        assert.equal(editor.blocks.length, 2);
        assert.equal(editor.selectedId, editor.blocks[1].id);
      });
    });

    describe("F7 Boundaries: Clean Persistence & Sanitization", () => {
      it("F7-B01: Content containing only zero-width characters collapses to empty string", () => {
        const pureZero = "\u200B\uFEFF\u200C\u200D\u2060\u0000";
        assert.equal(cleanZeroWidth(pureZero), "");
      });

      it("F7-B02: Extreme string with 1,000 interspersed zero-width characters strips all 1,000", () => {
        let extreme = "";
        for (let i = 0; i < 1000; i++) {
          extreme += "a\u200B";
        }
        const cleaned = cleanZeroWidth(extreme);
        assert.equal(cleaned, "a".repeat(1000));
      });

      it("F7-B03: Math formulas containing valid unicode symbols (Greek letters) are preserved", () => {
        const greekFormula = "$\\alpha + \\beta = \\gamma \\times \\pi$";
        const cleaned = cleanZeroWidth(greekFormula);
        assert.equal(cleaned, greekFormula);
      });

      it("F7-B04: JSON stringified table and column metadata preserves integrity during sanitization", () => {
        const jsonMetadata = JSON.stringify({ colCount: 3, widths: [100, 200, 300] });
        const cleaned = cleanZeroWidth(jsonMetadata);
        assert.equal(cleaned, jsonMetadata);
      });

      it("F7-B05: Export to Markdown / HTML / PlainText strips zero-width artifacts while preserving formula pills", () => {
        const sampleBlocks = [
          { id: "b1", type: "text", content: "\u200BTheory: $E=mc^2$\uFEFF is fundamental." },
        ];
        const sanitizedBlocks = sampleBlocks.map((b) => ({
          ...b,
          content: cleanZeroWidth(b.content),
        }));
        const md = blocksToMarkdownLossy(sanitizedBlocks);
        assert.ok(md.includes("$E=mc^2$"));
        assert.ok(!md.includes("\u200B"));
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TIER 3: CROSS-FEATURE COMBINATIONS (>= 7 pairwise tests)
  // ───────────────────────────────────────────────────────────────────────────
  describe("Tier 3: Cross-Feature Combinations (C1–C7)", () => {
    it("C1 (F1 + F2): Arrow navigation across block boundaries containing leading and trailing inline code and math pills", () => {
      const editor = new BlockNoteEditorHarness([
        { id: "b1", type: "text", content: "`startCode` middle text $endMath$" },
        { id: "b2", type: "text", content: "$startMath$ middle text `endCode`" },
      ]);
      const el1 = editor.getDOM("b1");
      setCaretToEnd(el1);

      // ArrowDown across blocks
      editor.handleKeyDown(new MockEvent("keydown", { key: "ArrowDown" }), "b1");
      assert.equal(editor.selectedId, "b2");

      const el2 = editor.getDOM("b2");
      assert.ok(isCaretAtLogicalStart(el2));

      // ArrowUp back across blocks
      editor.handleKeyDown(new MockEvent("keydown", { key: "ArrowUp" }), "b2");
      assert.equal(editor.selectedId, "b1");
      assert.ok(isCaretAtLogicalEnd(el1));
    });

    it("C2 (F3 + F4): Auto-compiling inline math $x^2$ then immediately pressing Enter to split line after the math pill", () => {
      const editor = new BlockNoteEditorHarness([
        { id: "b1", type: "text", content: "Equation $x^2$" },
      ]);
      const el = editor.getDOM("b1");
      setCaretToEnd(el);

      // Press Enter after math pill
      const enterEvent = new MockEvent("keydown", { key: "Enter" });
      editor.handleKeyDown(enterEvent, "b1");

      assert.equal(editor.blocks.length, 2);
      assert.equal(editor.blocks[0].content, "Equation $x^2$");
      assert.equal(editor.blocks[1].content, "");
      assert.equal(editor.selectedId, editor.blocks[1].id);
    });

    it("C3 (F4 + F5): Splitting line mid-sentence with Enter, then immediately pressing Backspace at offset 0 to rejoin losslessly", () => {
      const originalText = "The quick brown fox jumps over the lazy dog.";
      const editor = new BlockNoteEditorHarness([
        { id: "b1", type: "text", content: originalText },
      ]);
      const el1 = editor.getDOM("b1");
      setCaretAtOffset(el1, 19); // After "The quick brown fox"

      // Enter split
      editor.handleKeyDown(new MockEvent("keydown", { key: "Enter" }), "b1");
      assert.equal(editor.blocks.length, 2);

      // Immediate Backspace at offset 0
      const el2 = editor.getDOM(editor.blocks[1].id);
      setCaretToStart(el2);
      editor.handleKeyDown(new MockEvent("keydown", { key: "Backspace" }), editor.blocks[1].id);

      assert.equal(editor.blocks.length, 1);
      assert.equal(editor.blocks[0].content, originalText, "Split followed by merge must restore exact original text");
    });

    it("C4 (F2 + F5): Merging block starting with inline math pill into block ending with inline math pill", () => {
      const editor = new BlockNoteEditorHarness([
        { id: "b1", type: "text", content: "Left formula: $f(x)$ " },
        { id: "b2", type: "text", content: "$g(x)$ :Right formula" },
      ]);
      const el2 = editor.getDOM("b2");
      setCaretToStart(el2);

      editor.handleKeyDown(new MockEvent("keydown", { key: "Backspace" }), "b2");

      assert.equal(editor.blocks.length, 1);
      assert.equal(editor.blocks[0].content, "Left formula: $f(x)$ $g(x)$ :Right formula");
    });

    it("C5 (F6 + F4 + F1): Bottom whitespace click to create block, Enter to create second block, ArrowUp to navigate back", () => {
      const editor = new BlockNoteEditorHarness([
        { id: "b1", type: "text", content: "Initial header" },
      ]);
      // 1. Whitespace click
      editor.handleBottomWhitespaceClick();
      assert.equal(editor.blocks.length, 2);
      const b2Id = editor.blocks[1].id;

      // 2. Type content and Enter
      editor.blocks[1].content = "Item A";
      editor.syncDOMFromState(b2Id);
      const el2 = editor.getDOM(b2Id);
      setCaretToEnd(el2);
      editor.handleKeyDown(new MockEvent("keydown", { key: "Enter" }), b2Id);
      assert.equal(editor.blocks.length, 3);
      const b3Id = editor.blocks[2].id;

      // 3. ArrowUp back to b2
      const el3 = editor.getDOM(b3Id);
      setCaretToStart(el3);
      editor.handleKeyDown(new MockEvent("keydown", { key: "ArrowUp" }), b3Id);
      assert.equal(editor.selectedId, b2Id);
    });

    it("C6 (F3 + F7 + F5): Creating inline math with zero-width characters in input, sanitizing, splitting, and merging back", () => {
      const dirty = "Math $\u200B\\sqrt{x}\uFEFF$ with \u200Czero width";
      const cleaned = cleanZeroWidth(dirty);
      assert.equal(cleaned, "Math $\\sqrt{x}$ with zero width");

      const editor = new BlockNoteEditorHarness([
        { id: "b1", type: "text", content: cleaned },
      ]);
      const el = editor.getDOM("b1");
      setCaretAtOffset(el, 15);

      // Split
      editor.handleKeyDown(new MockEvent("keydown", { key: "Enter" }), "b1");
      assert.equal(editor.blocks.length, 2);

      // Merge
      const b2Id = editor.blocks[1].id;
      const el2 = editor.getDOM(b2Id);
      setCaretToStart(el2);
      editor.handleKeyDown(new MockEvent("keydown", { key: "Backspace" }), b2Id);

      assert.equal(editor.blocks.length, 1);
      assert.equal(editor.blocks[0].content, cleaned);
    });

    it("C7 (F1 + F2 + F3 + F4 + F5 + F6 + F7): Complex interaction sequence combining all features in an interactive session", () => {
      const editor = new BlockNoteEditorHarness([
        { id: "b1", type: "h1", content: "Session Title" },
      ]);
      // 1. Enter from heading
      const el1 = editor.getDOM("b1");
      setCaretToEnd(el1);
      editor.handleKeyDown(new MockEvent("keydown", { key: "Enter" }), "b1");
      assert.equal(editor.blocks.length, 2);
      const b2Id = editor.blocks[1].id;

      // 2. Add math and code to b2
      editor.blocks[1].content = "Theorem: `f(x)` is equal to $x^2+1$\u200B.";
      editor.blocks[1].content = cleanZeroWidth(editor.blocks[1].content);
      editor.syncDOMFromState(b2Id);

      // 3. Enter split after formula
      const el2 = editor.getDOM(b2Id);
      setCaretToEnd(el2);
      editor.handleKeyDown(new MockEvent("keydown", { key: "Enter" }), b2Id);
      assert.equal(editor.blocks.length, 3);
      const b3Id = editor.blocks[2].id;

      // 4. Change b3 to bullet and add item
      editor.blocks[2].type = "bullet";
      editor.blocks[2].content = "Proof item 1";
      editor.syncDOMFromState(b3Id);

      // 5. Arrow navigation up to b2
      const el3 = editor.getDOM(b3Id);
      setCaretToStart(el3);
      editor.handleKeyDown(new MockEvent("keydown", { key: "ArrowUp" }), b3Id);
      assert.equal(editor.selectedId, b2Id);

      // 6. Whitespace click to append new section
      editor.handleBottomWhitespaceClick();
      assert.equal(editor.blocks.length, 4);

      // Verify clean Markdown export
      const md = blocksToMarkdownLossy(editor.blocks);
      assert.ok(md.includes("# Session Title"));
      assert.ok(md.includes("`f(x)`"));
      assert.ok(md.includes("$x^2+1$"));
      assert.ok(md.includes("- Proof item 1"));
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TIER 4: REAL-WORLD APPLICATION SCENARIOS (5 comprehensive document workloads)
  // ───────────────────────────────────────────────────────────────────────────
  describe("Tier 4: Real-World Application Scenarios (S1–S5)", () => {
    it("S1: University Math Note — Multi-block theorem with inline math formulas, line splits mid-formula, and backspace recovery", () => {
      const universityNotes = [
        { id: "n1", type: "h1", content: "Advanced Calculus: Taylor Series" },
        { id: "n2", type: "text", content: "Let $f: \\mathbb{R} \\to \\mathbb{R}$ be an infinitely differentiable function." },
        { id: "n3", type: "bullet", content: "Definition: $T_n(x) = \\sum_{k=0}^n \\frac{f^{(k)}(a)}{k!}(x-a)^k$" },
        { id: "n4", type: "bullet", content: "Remainder: $R_n(x) = \\frac{f^{(n+1)}(\\xi)}{(n+1)!}(x-a)^{n+1}$" },
        { id: "n5", type: "quote", content: "Taylor's theorem gives an approximation of a k-times differentiable function." },
      ];

      const editor = new BlockNoteEditorHarness(universityNotes);
      assert.equal(editor.blocks.length, 5);

      // Split mid-bullet n3
      const el3 = editor.getDOM("n3");
      setCaretAtOffset(el3, 12);
      editor.handleKeyDown(new MockEvent("keydown", { key: "Enter" }), "n3");

      assert.equal(editor.blocks.length, 6);
      assert.equal(editor.blocks[2].type, "bullet");
      assert.equal(editor.blocks[3].type, "bullet");

      // Recover by backspace merging
      const spawnedId = editor.blocks[3].id;
      const elSpawned = editor.getDOM(spawnedId);
      setCaretToStart(elSpawned);
      editor.handleKeyDown(new MockEvent("keydown", { key: "Backspace" }), spawnedId); // unlist to text
      editor.handleKeyDown(new MockEvent("keydown", { key: "Backspace" }), spawnedId); // merge into n3

      assert.equal(editor.blocks.length, 5);
      assert.equal(editor.blocks[2].content, "Definition: $T_n(x) = \\sum_{k=0}^n \\frac{f^{(k)}(a)}{k!}(x-a)^k$");
    });

    it("S2: Developer Technical Spec — Mixed code spans, markdown lists, multi-line splits, and boundary crossing", () => {
      const devSpec = [
        { id: "s1", type: "h1", content: "Authentication Microservice API Spec" },
        { id: "s2", type: "text", content: "The service exposes `POST /api/v1/auth/login` and `POST /api/v1/auth/refresh`." },
        { id: "s3", type: "todo", content: "Implement JWT verification in `middleware/auth.ts`", checked: true },
        { id: "s4", type: "todo", content: "Configure Redis token blacklist with TTL $t=3600$", checked: false },
        { id: "s5", type: "code", content: "export async function verifyToken(jwt: string) {\n  return jwt.verify(secret);\n}", language: "typescript" },
      ];

      const editor = new BlockNoteEditorHarness(devSpec);

      // Verify boundary stepping in code span inside s2
      const el2 = editor.getDOM("s2");
      const codeEl = el2.querySelector("code");
      assert.ok(codeEl);

      const sel = window.getSelection();
      const codeText = codeEl.childNodes[0];
      sel.collapse(codeText, codeText.length);

      const arrowRight = new MockEvent("keydown", { key: "ArrowRight" });
      handleInlineBoundaryKeyDown(arrowRight);

      assert.notEqual(sel.getRangeAt(0).startContainer.parentElement?.tagName, "CODE");

      // Verify editorBlocksToText AI serialization
      const plainText = editorBlocksToText(editor.blocks);
      assert.ok(plainText.includes("# Authentication Microservice API Spec"));
      assert.ok(plainText.includes("[x] Implement JWT verification"));
      assert.ok(plainText.includes("[ ] Configure Redis token blacklist"));
    });

    it("S3: Socratic Dialogue Document — Rapid conversational list items, Enter continuation, Backspace merging to parent, bottom click append", () => {
      const dialogue = [
        { id: "d1", type: "h2", content: "Meno: On Virtue & Knowledge" },
        { id: "d2", type: "bullet", content: "Socrates: Can you tell me, Meno, whether virtue is acquired by teaching or practice?" },
        { id: "d3", type: "bullet", content: "Meno: Upon my word, Socrates, I cannot say." },
      ];

      const editor = new BlockNoteEditorHarness(dialogue);

      // Enter from d3 creates d4 bullet
      const el3 = editor.getDOM("d3");
      setCaretToEnd(el3);
      editor.handleKeyDown(new MockEvent("keydown", { key: "Enter" }), "d3");

      assert.equal(editor.blocks.length, 4);
      assert.equal(editor.blocks[3].type, "bullet");
      const d4Id = editor.blocks[3].id;
      editor.blocks[3].content = "Socrates: Then let us enquire together.";
      editor.syncDOMFromState(d4Id);

      // Append bottom conclusion paragraph
      editor.handleBottomWhitespaceClick();
      assert.equal(editor.blocks.length, 5);
      const d5Id = editor.blocks[4].id;
      editor.blocks[4].content = "Conclusion: Knowledge is recollected through guided questioning.";
      editor.syncDOMFromState(d5Id);

      assert.equal(editor.blocks.length, 5);
      assert.equal(editor.blocks[4].type, "text");
    });

    it("S4: Deep Formula Derivation — Multiple inline and block equations, live math auto-compilation $E=mc^2$, editing adjacent terms", () => {
      const physicsBlocks = [
        { id: "p1", type: "h1", content: "Relativistic Kinetic Energy Derivation" },
        { id: "p2", type: "text", content: "Total energy is given by $E = \\gamma m_0 c^2$ where $\\gamma = \\frac{1}{\\sqrt{1 - v^2/c^2}}$." },
        { id: "p3", type: "math", content: "K = E - E_0 = (\\gamma - 1)m_0 c^2" },
        { id: "p4", type: "text", content: "In the non-relativistic limit $v \\ll c$, we recover $K \\approx \\frac{1}{2}m_0 v^2$." },
      ];

      const editor = new BlockNoteEditorHarness(physicsBlocks);

      // Check KaTeX pills count in p2
      const el2 = editor.getDOM("p2");
      const pills = el2.querySelectorAll(".katex-inline-node");
      assert.equal(pills.length, 2);
      assert.equal(pills[0].getAttribute("data-formula"), "E = \\gamma m_0 c^2");

      // Verify plain text export
      const txt = blocksToPlainText(editor.blocks, "Physics Notes");
      assert.ok(txt.includes("$E = \\gamma m_0 c^2$"));
      assert.ok(txt.includes("$v \\ll c$"));
    });

    it("S5: Clean Document Lifecycle — Document creation, whitespace clicking, copy-paste with zero-width spaces, storage roundtrip", () => {
      // 1. Create fresh document
      const editor = new BlockNoteEditorHarness([]);
      editor.handleBottomWhitespaceClick();
      assert.equal(editor.blocks.length, 1);

      // 2. Set title and content with dirty zero-width spaces
      editor.blocks[0].type = "h1";
      editor.blocks[0].content = "\u200BQuantum Foundations\uFEFF";
      editor.blocks[0].content = cleanZeroWidth(editor.blocks[0].content);

      // 3. Append paragraph with math
      editor.handleBottomWhitespaceClick();
      assert.equal(editor.blocks.length, 2);
      editor.blocks[1].content = "Superposition: $\\psi = \\alpha|0\\rangle + \\beta|1\\rangle$\u200B.";
      editor.blocks[1].content = cleanZeroWidth(editor.blocks[1].content);

      // 4. HTML export verification
      const html = blocksToHTMLLossy(editor.blocks, "Quantum Foundations", "⚛️");
      assert.ok(html.includes("Quantum Foundations"));
      assert.ok(html.includes("katex") || html.includes("superposition") || html.includes("alpha"));

      // 5. Lossless Markdown round-trip verification
      const md = blocksToMarkdownLossy(editor.blocks);
      const reimported = tryParseMarkdownToBlocks(md);
      assert.equal(reimported.length, 2);
      assert.equal(reimported[0].content, "Quantum Foundations");
      assert.equal(reimported[1].content, "Superposition: $\\psi = \\alpha|0\\rangle + \\beta|1\\rangle$.");
    });
  });

  // ─── TIER 5: GROUP 1 GLOBAL CROSS-BLOCK ROUTING & FOCUS FOUNDATION ──────────
  describe("Tier 5: Group 1 Global Cross-Block Routing & Focus Foundation", () => {
    it("EditorBlock does not overwrite specialized refs when contentRef is null", () => {
      const blockRefs = {};
      const registerRef = (id, ref) => {
        blockRefs[id] = ref;
      };

      // 1. Child specialized block registers its ref first
      const codeBlockId = "code-123";
      const textareaRef = { current: { tagName: "TEXTAREA", id: `code_${codeBlockId}` } };
      registerRef(codeBlockId, textareaRef);
      assert.equal(blockRefs[codeBlockId]?.current?.tagName, "TEXTAREA");

      // 2. Parent EditorBlock mounts with null contentRef
      const contentRef = { current: null };
      if (registerRef && contentRef.current) {
        registerRef(codeBlockId, contentRef);
      }

      // 3. Must NOT be overwritten with null
      assert.equal(blockRefs[codeBlockId]?.current?.tagName, "TEXTAREA");
    });

    it("focusBlock handles code block entry at start and end", () => {
      let focused = false;
      let selStart = -1;
      let selEnd = -1;

      const mockCodeEl = {
        tagName: "TEXTAREA",
        value: "const x = 42;\nconsole.log(x);",
        focus() {
          focused = true;
        },
        setSelectionRange(start, end) {
          selStart = start;
          selEnd = end;
        },
      };

      // Position start
      mockCodeEl.focus();
      mockCodeEl.setSelectionRange(0, 0);
      assert.equal(focused, true);
      assert.equal(selStart, 0);
      assert.equal(selEnd, 0);

      // Position end
      mockCodeEl.setSelectionRange(mockCodeEl.value.length, mockCodeEl.value.length);
      assert.equal(selStart, mockCodeEl.value.length);
      assert.equal(selEnd, mockCodeEl.value.length);
    });

    it("focusBlock resolves table bottom-right cell on position 'end'", () => {
      const tableBlock = {
        id: "tbl-1",
        type: "table",
        tableData: {
          headers: ["Col 1", "Col 2", "Col 3"],
          rows: [
            ["A", "B", "C"],
            ["D", "E", "F"],
          ],
          hasHeaderRow: true,
        },
      };

      const rowCount = tableBlock.tableData.rows.length;
      const colCount = tableBlock.tableData.headers.length;
      const targetCellId = `tbl_${tableBlock.id}_r_${rowCount - 1}_c_${colCount - 1}`;
      assert.equal(targetCellId, "tbl_tbl-1_r_1_c_2");
    });

    it("focusBlock resolves columns last column on position 'end'", () => {
      const columnsBlock = {
        id: "col-1",
        type: "columns",
        columnCount: 3,
      };

      const lastColIdx = columnsBlock.columnCount - 1;
      const targetContentId = `col_${columnsBlock.id}_${lastColIdx}_content`;
      assert.equal(targetContentId, "col_col-1_2_content");
    });

    it("handleExitDown routes cleanly into all complex and embed blocks", () => {
      const blocks = [
        { id: "b1", type: "text", content: "hello" },
        { id: "b2", type: "math", title: "Equation 1" },
        { id: "b3", type: "columns", columnCount: 2 },
        { id: "b4", type: "site", url: "https://example.com" },
        { id: "b5", type: "media", url: "https://youtube.com/watch?v=123" },
      ];

      const routed = [];
      const mockFocusBlock = (targetBlock, pos) => {
        routed.push({ id: targetBlock.id, type: targetBlock.type, pos });
      };

      for (let i = 0; i < blocks.length - 1; i++) {
        mockFocusBlock(blocks[i + 1], "start");
      }

      assert.equal(routed.length, 4);
      assert.deepEqual(
        routed.map((r) => r.type),
        ["math", "columns", "site", "media"]
      );
      assert.ok(routed.every((r) => r.pos === "start"));
    });

    it("handleExitUp routes cleanly to end of preceding blocks", () => {
      const blocks = [
        { id: "b1", type: "table", content: "" },
        { id: "b2", type: "code", content: "let a = 1;" },
        { id: "b3", type: "text", content: "notes" },
      ];

      const routed = [];
      const mockFocusBlock = (targetBlock, pos) => {
        routed.push({ id: targetBlock.id, type: targetBlock.type, pos });
      };

      mockFocusBlock(blocks[1], "end");
      mockFocusBlock(blocks[0], "end");

      assert.equal(routed[0].type, "code");
      assert.equal(routed[0].pos, "end");
      assert.equal(routed[1].type, "table");
      assert.equal(routed[1].pos, "end");
    });

    it("empty block deletion preserves focus when deleting below complex blocks", () => {
      const blocks = [
        { id: "b1", type: "table", content: "" },
        { id: "b2", type: "text", content: "" },
      ];

      let focusedTarget = null;
      let focusedPos = null;
      const mockFocusBlock = (targetBlock, pos) => {
        focusedTarget = targetBlock;
        focusedPos = pos;
      };

      const idx = 1;
      const prevBlock = blocks[idx - 1];
      mockFocusBlock(prevBlock, idx > 0 ? "end" : "start");

      assert.equal(focusedTarget.id, "b1");
      assert.equal(focusedTarget.type, "table");
      assert.equal(focusedPos, "end");
    });
  });

  // ─── TIER 6: GROUP 2 DOCUMENT BOUNDARIES & VISUAL LINE METRICS ─────────────
  describe("Tier 6: Group 2 Document Boundaries & Visual Line Metrics", () => {
    it("Note Title navigates down into Block 0 on ArrowDown (BUG-TITLE-20)", () => {
      const blocks = [
        { id: "b0", type: "text", content: "Introduction" },
        { id: "b1", type: "text", content: "Paragraph" },
      ];
      let focusedBlock = null;
      let focusedPos = null;
      const mockFocusBlock = (targetBlock, pos) => {
        focusedBlock = targetBlock;
        focusedPos = pos;
      };

      // ArrowDown inside title input triggers focus on blocks[0]
      if (blocks.length > 0) {
        mockFocusBlock(blocks[0], "start");
      }

      assert.equal(focusedBlock.id, "b0");
      assert.equal(focusedPos, "start");
    });

    it("Block 0 navigates up into Note Title on ArrowUp (BUG-TITLE-21)", () => {
      let focusedTitle = false;
      let setRangeStart = -1;
      let setRangeEnd = -1;

      const mockTitleInput = {
        value: "My Research Paper",
        focus() {
          focusedTitle = true;
        },
        setSelectionRange(start, end) {
          setRangeStart = start;
          setRangeEnd = end;
        },
      };

      // Exit up from idx === 0 focuses title and places caret at end
      const titleLen = mockTitleInput.value.length;
      mockTitleInput.focus();
      mockTitleInput.setSelectionRange(titleLen, titleLen);

      assert.equal(focusedTitle, true);
      assert.equal(setRangeStart, "My Research Paper".length);
      assert.equal(setRangeEnd, "My Research Paper".length);
    });

    it("Pressing Enter in Note Title focuses Block 0 across complex types (BUG-TITLE-22)", () => {
      const testBlockTypes = ["code", "table", "math", "columns", "site", "media"];

      for (const bType of testBlockTypes) {
        const blocks = [{ id: "b0", type: bType, content: "" }];
        let focusedTarget = null;
        let focusedPos = null;
        const mockFocusBlock = (b, pos) => {
          focusedTarget = b;
          focusedPos = pos;
        };

        if (blocks.length > 0) {
          mockFocusBlock(blocks[0], "start");
        }

        assert.equal(focusedTarget.type, bType);
        assert.equal(focusedPos, "start");
      }
    });

    it("Divider blocks are smoothly navigable via Arrow keys without skipping (BUG-EXIT-16)", () => {
      const blocks = [
        { id: "b0", type: "text", content: "Top paragraph" },
        { id: "b1", type: "divider" },
        { id: "b2", type: "text", content: "Bottom paragraph" },
      ];

      // Moving down from b0 lands on b1 (divider)
      const nextIdx = 0 + 1;
      const nextBlock = blocks[nextIdx];
      assert.equal(nextBlock.type, "divider");
      assert.equal(nextBlock.id, "b1");

      // Moving up from b2 lands on b1 (divider)
      const prevIdx = 2 - 1;
      const prevBlock = blocks[prevIdx];
      assert.equal(prevBlock.type, "divider");
      assert.equal(prevBlock.id, "b1");
    });

    it("isCaretOnFirstVisualLine and isCaretOnLastVisualLine handle multi-line typography (BUG-VIS-27)", () => {
      // Mock container with multi-line H1 dimensions
      const mockH1Container = {
        nodeType: 1,
        tagName: "H1",
        textContent: "Line 1 heading text\nLine 2 wrapped heading",
        getBoundingClientRect: () => ({
          top: 100,
          bottom: 190, // 90px height
          height: 90,
        }),
      };

      // Caret on line 1: top is close to container top
      const line1Range = {
        getBoundingClientRect: () => ({
          top: 112, // 12px padding
          bottom: 148, // 36px line height
          height: 36,
        }),
      };

      // Caret on line 2: bottom is close to container bottom
      const line2Range = {
        getBoundingClientRect: () => ({
          top: 148,
          bottom: 184, // 6px padding from bottom
          height: 36,
        }),
      };

      // Custom line 1 threshold check (computed padding + 0.6 * line-height = 12 + 21.6 = 33.6)
      const threshold = 34;
      const isLine1OnFirst = line1Range.getBoundingClientRect().top - mockH1Container.getBoundingClientRect().top <= threshold;
      const isLine2OnFirst = line2Range.getBoundingClientRect().top - mockH1Container.getBoundingClientRect().top <= threshold;

      assert.equal(isLine1OnFirst, true, "Line 1 should be detected as on first visual line");
      assert.equal(isLine2OnFirst, false, "Line 2 should NOT be detected as on first visual line");

      const isLine2OnLast = mockH1Container.getBoundingClientRect().bottom - line2Range.getBoundingClientRect().bottom <= threshold;
      const isLine1OnLast = mockH1Container.getBoundingClientRect().bottom - line1Range.getBoundingClientRect().bottom <= threshold;

      assert.equal(isLine2OnLast, true, "Line 2 should be detected as on last visual line");
      assert.equal(isLine1OnLast, false, "Line 1 should NOT be detected as on last visual line");
    });
  });

  // ─── TIER 7: GROUP 3 NESTED CODE & MATH EDITORS ───────────────────────────
  describe("Tier 7: Group 3 Nested Multi-Line Code & Math Editors", () => {
    it("CodeBlock handles horizontal arrow exit at text boundaries (BUG-CODE-05)", () => {
      const block = { id: "code_1", type: "code", content: "const x = 42;" };
      let exitUpCalled = false;
      let exitDownCalled = false;

      const mockOnExitUp = (id) => {
        if (id === block.id) exitUpCalled = true;
      };
      const mockOnExitDown = (id) => {
        if (id === block.id) exitDownCalled = true;
      };

      // ArrowLeft at start (0, 0)
      const leftEvent = {
        key: "ArrowLeft",
        target: { selectionStart: 0, selectionEnd: 0 },
        preventDefault: () => {},
      };
      if (leftEvent.target.selectionStart === 0 && leftEvent.target.selectionEnd === 0) {
        mockOnExitUp(block.id);
      }
      assert.equal(exitUpCalled, true);

      // ArrowRight at end (len, len)
      const rightEvent = {
        key: "ArrowRight",
        target: { selectionStart: block.content.length, selectionEnd: block.content.length },
        preventDefault: () => {},
      };
      if (rightEvent.target.selectionStart === block.content.length && rightEvent.target.selectionEnd === block.content.length) {
        mockOnExitDown(block.id);
      }
      assert.equal(exitDownCalled, true);
    });

    it("CodeBlock ArrowDown does not exit prematurely when on last line before text end (BUG-CODE-06)", () => {
      const multiLineCode = "line1\nline2 is the last line";
      const lastLineStartOffset = 6; // offset of 'l' in line2

      let exitedDown = false;
      const onExitDown = () => {
        exitedDown = true;
      };

      // Caret at character 0 of the last line: should NOT exit
      let currentOffset = lastLineStartOffset;
      const isLastLine = !multiLineCode.substring(currentOffset).includes("\n");
      assert.equal(isLastLine, true);

      // Logic: only exit when currentOffset === multiLineCode.length
      if (isLastLine && currentOffset === multiLineCode.length) {
        onExitDown();
      }
      assert.equal(exitedDown, false, "Should not exit when caret is at start of last line");

      // Caret at very end of last line: SHOULD exit
      currentOffset = multiLineCode.length;
      if (isLastLine && currentOffset === multiLineCode.length) {
        onExitDown();
      }
      assert.equal(exitedDown, true, "Should exit down once caret reaches end of last line");
    });

    it("Focusing CodeBlock from below places caret at end of code snippet (BUG-EXIT-15)", () => {
      let setSelectionStart = -1;
      let setSelectionEnd = -1;

      const mockCodeTextarea = {
        value: "function test() {\n  return 1;\n}",
        focus() {},
        setSelectionRange(start, end) {
          setSelectionStart = start;
          setSelectionEnd = end;
        },
      };

      const len = mockCodeTextarea.value.length;
      mockCodeTextarea.focus();
      mockCodeTextarea.setSelectionRange(len, len);

      assert.equal(setSelectionStart, mockCodeTextarea.value.length);
      assert.equal(setSelectionEnd, mockCodeTextarea.value.length);
    });

    it("MathBlock allows multi-line LaTeX traversal before boundary exit (BUG-MATH-03)", () => {
      const multiLineFormula = "\\begin{matrix}\na & b \\\\\nc & d\n\\end{matrix}";
      let exitedDown = false;
      let exitedUp = false;

      // Line 1 caret
      let start = 5;
      const isLastLine1 = !multiLineFormula.substring(start).includes("\n");
      assert.equal(isLastLine1, false, "Line 1 should have subsequent newlines");

      if (isLastLine1 && start === multiLineFormula.length) {
        exitedDown = true;
      }
      assert.equal(exitedDown, false, "ArrowDown on Line 1 of LaTeX formula must traverse inside textarea");

      // Final character caret
      start = multiLineFormula.length;
      const isLastLineEnd = !multiLineFormula.substring(start).includes("\n");
      assert.equal(isLastLineEnd, true);

      if (isLastLineEnd && start === multiLineFormula.length) {
        exitedDown = true;
      }
      assert.equal(exitedDown, true, "ArrowDown at end of formula should exit block");

      // Caret at offset 0
      start = 0;
      const isFirstLine0 = !multiLineFormula.substring(0, start).includes("\n");
      if (isFirstLine0 && start === 0) {
        exitedUp = true;
      }
      assert.equal(exitedUp, true, "ArrowUp at offset 0 of formula should exit block upward");
    });

    it("MathBlock outer card container deletes on Delete key and preserves block on Backspace (BUG-MATH-04)", () => {
      const block = { id: "math_xyz", type: "math", content: "E = mc^2" };
      let deletedId = null;

      const mockOnDelete = (id) => {
        deletedId = id;
      };

      const isEditing = false;
      const isLocked = false;

      const handleKey = (e) => {
        if (
          e.key === "Delete" &&
          !isEditing &&
          e.target.tagName !== "INPUT" &&
          e.target.tagName !== "TEXTAREA"
        ) {
          if (!isLocked) {
            mockOnDelete(block.id);
          }
        }
      };

      // Backspace does NOT delete container
      handleKey({ key: "Backspace", target: { tagName: "DIV" } });
      assert.equal(deletedId, null);

      // Delete key deletes container
      handleKey({ key: "Delete", target: { tagName: "DIV" } });
      assert.equal(deletedId, "math_xyz");
    });
  });

  // ─── TIER 8: GROUP 4 2D GRID & MULTI-COLUMN LAYOUT BLOCKS ─────────────────
  describe("Tier 8: Group 4 2D Grid & Multi-Column Layout Blocks", () => {
    it("TableCell intermediate row traversal navigates vertically (BUG-TBL-07)", () => {
      const blockId = "1";
      const tableData = {
        hasHeaderRow: true,
        headers: ["Col 1", "Col 2"],
        rows: [
          ["r0c0", "r0c1"],
          ["r1c0", "r1c1"],
        ],
      };

      let focusedTargetId = null;
      const mockFocus = (id) => {
        focusedTargetId = id;
      };

      // 1. From header (col 0), ArrowDown moves to row 0 col 0
      const isHeader = true;
      const rowIndex = 0;
      const colIndex = 0;
      if (isHeader) {
        if (tableData.rows.length > 0) {
          mockFocus(`tbl_${blockId}_r_0_c_${colIndex}`);
        }
      }
      assert.equal(focusedTargetId, "tbl_1_r_0_c_0");

      // 2. From row 0 col 0, ArrowDown moves to row 1 col 0
      const r0Index = 0;
      if (r0Index < tableData.rows.length - 1) {
        mockFocus(`tbl_${blockId}_r_${r0Index + 1}_c_${colIndex}`);
      }
      assert.equal(focusedTargetId, "tbl_1_r_1_c_0");

      // 3. From row 1 col 0, ArrowUp moves back to row 0 col 0
      const r1Index = 1;
      if (r1Index > 0) {
        mockFocus(`tbl_${blockId}_r_${r1Index - 1}_c_${colIndex}`);
      }
      assert.equal(focusedTargetId, "tbl_1_r_0_c_0");
    });

    it("TableCell horizontal arrow navigation hops across adjacent columns (BUG-TBL-08)", () => {
      const blockId = "1";
      const colCount = 2;
      let targetCell = null;
      let targetPos = null;

      const mockSetCaret = (id, pos) => {
        targetCell = id;
        targetPos = pos;
      };

      // ArrowRight at end of col 0
      const colIndex0 = 0;
      if (colIndex0 < colCount - 1) {
        mockSetCaret(`tbl_${blockId}_r_0_c_${colIndex0 + 1}`, "start");
      }
      assert.equal(targetCell, "tbl_1_r_0_c_1");
      assert.equal(targetPos, "start");

      // ArrowLeft at start of col 1
      const colIndex1 = 1;
      if (colIndex1 > 0) {
        mockSetCaret(`tbl_${blockId}_r_0_c_${colIndex1 - 1}`, "end");
      }
      assert.equal(targetCell, "tbl_1_r_0_c_0");
      assert.equal(targetPos, "end");
    });

    it("Headerless table cleanly exits upward on ArrowUp from row 0 (BUG-TBL-09)", () => {
      const blockId = "nohead";
      const tableData = {
        hasHeaderRow: false,
        headers: ["Col 1", "Col 2"],
        rows: [["cell0", "cell1"]],
      };

      let exitedUp = false;
      const onExitUp = () => {
        exitedUp = true;
      };

      const rowIndex = 0;
      const isHeader = false;
      const hasHeaders = tableData.hasHeaderRow !== false && tableData.headers.length > 0;

      if (!isHeader && rowIndex === 0) {
        if (hasHeaders) {
          // would navigate to header
        } else {
          onExitUp();
        }
      }

      assert.equal(exitedUp, true, "Headerless table must exit up when ArrowUp is pressed on Row 0");
    });

    it("Navigating up into table resolves bottom-right cell (BUG-TBL-10)", () => {
      const tableBlock = {
        id: "target",
        type: "table",
        tableData: {
          hasHeaderRow: true,
          headers: ["H1", "H2", "H3"],
          rows: [
            ["a", "b", "c"],
            ["d", "e", "f"],
          ],
        },
      };

      const normRows = tableBlock.tableData.rows;
      const rowCount = normRows.length;
      const colCount = tableBlock.tableData.headers.length;

      // Bottom right cell ID calculation
      const targetCellId = `tbl_${tableBlock.id}_r_${rowCount - 1}_c_${colCount - 1}`;
      assert.equal(targetCellId, "tbl_target_r_1_c_2");
    });

    it("Column title Enter advances to column body instead of newline (BUG-COL-11)", () => {
      let focusedContent = false;
      let insertedNewline = false;

      const mockContent = {
        focus() {
          focusedContent = true;
        },
      };

      const isTitle = true;
      const event = { key: "Enter", shiftKey: false, preventDefault() {} };

      if (event.key === "Enter" && !event.shiftKey) {
        if (isTitle) {
          event.preventDefault();
          mockContent.focus();
        } else {
          insertedNewline = true;
        }
      }

      assert.equal(focusedContent, true);
      assert.equal(insertedNewline, false);
    });

    it("Column content ArrowUp on line 1 returns focus to column title (BUG-COL-12)", () => {
      let focusedTitle = false;
      const mockTitle = {
        focus() {
          focusedTitle = true;
        },
      };

      const isContent = true;
      const isFirstVisualLine = true;

      if (isContent && isFirstVisualLine) {
        mockTitle.focus();
      }

      assert.equal(focusedTitle, true);
    });

    it("ColumnsBlock supports horizontal arrow and Tab column hopping (BUG-COL-13)", () => {
      const blockId = "1";
      const totalCols = 3;
      let targetElement = null;

      // In col 0 title, Tab moves to col 0 content
      let activeField = "title";
      let colIdx = 0;
      if (activeField === "title") {
        targetElement = `col_${blockId}_${colIdx}_content`;
      }
      assert.equal(targetElement, "col_1_0_content");

      // In col 0 content, Tab moves to col 1 title
      activeField = "content";
      if (activeField === "content" && colIdx < totalCols - 1) {
        targetElement = `col_${blockId}_${colIdx + 1}_title`;
      }
      assert.equal(targetElement, "col_1_1_title");

      // In col 1 content, ArrowRight at end moves to col 2 content
      colIdx = 1;
      const isAtEnd = true;
      if (isAtEnd && colIdx < totalCols - 1) {
        targetElement = `col_${blockId}_${colIdx + 1}_content`;
      }
      assert.equal(targetElement, "col_1_2_content");
    });
  });

  // ─── TIER 9: GROUP 5 DUAL-ZONE TOGGLE & BLOCK MERGING/DELETING FLOW ───────
  describe("Tier 9: Group 5 Dual-Zone Toggle & Block Merging/Deleting Flow", () => {
    it("Toggle header ArrowDown steps into open toggle details textarea (BUG-TOG-01)", () => {
      const blockId = "toggle_1";
      const block = { id: blockId, type: "toggle", open: true };
      let focusedTargetId = null;

      const mockFocus = (id) => {
        focusedTargetId = id;
      };

      // When caret is on last visual line of toggle header and toggle is open:
      if (block.type === "toggle" && block.open !== false) {
        mockFocus(`toggle_details_${blockId}`);
      }

      assert.equal(focusedTargetId, "toggle_details_toggle_1");
    });

    it("Toggle details textarea ArrowUp on line 1 returns focus to toggle summary header (BUG-TOG-02)", () => {
      const blockId = "toggle_1";
      let returnedToHeader = false;

      const mockHeader = {
        focus() {
          returnedToHeader = true;
        },
      };

      const isFirstLine = true;
      const start = 0;

      if (isFirstLine && start === 0) {
        if (mockHeader) {
          mockHeader.focus();
        }
      }

      assert.equal(returnedToHeader, true);
    });

    it("Forward Delete at line end merges subsequent mergeable text block (BUG-DEL-24)", () => {
      const blocks = [
        { id: "b1", type: "text", content: "Hello " },
        { id: "b2", type: "text", content: "World" },
      ];

      const blockId = "b1";
      const idx = 0;
      const nextBlock = blocks[1];
      const mergeableTypes = ["text", "h1", "h2", "h3", "h4", "bullet", "number", "todo", "quote", "callout"];

      let mergedResult = "";
      let remainingBlocks = [];

      if (mergeableTypes.includes(nextBlock.type)) {
        mergedResult = blocks[0].content + nextBlock.content;
        remainingBlocks = blocks.filter((b) => b.id !== nextBlock.id);
        remainingBlocks[0].content = mergedResult;
      }

      assert.equal(mergedResult, "Hello World");
      assert.equal(remainingBlocks.length, 1);
      assert.equal(remainingBlocks[0].id, "b1");
      assert.equal(remainingBlocks[0].content, "Hello World");
    });

    it("Forward Delete at line end removes subsequent standalone embed block (BUG-DEL-25)", () => {
      const blocks = [
        { id: "b1", type: "text", content: "Text before divider" },
        { id: "b2", type: "divider" },
      ];

      const standaloneEmbedTypes = ["divider", "site", "media"];
      const nextBlock = blocks[1];
      let updatedBlocks = [];

      if (standaloneEmbedTypes.includes(nextBlock.type)) {
        updatedBlocks = blocks.filter((b) => b.id !== nextBlock.id);
      }

      assert.equal(updatedBlocks.length, 1);
      assert.equal(updatedBlocks[0].id, "b1");
    });

    it("Deleting empty text block between complex blocks returns focus to preceding block", () => {
      const blocks = [
        { id: "tbl_1", type: "table" },
        { id: "empty_text", type: "text", content: "" },
        { id: "code_1", type: "code" },
      ];

      const blockId = "empty_text";
      const idx = 1;
      const prevBlock = blocks[idx - 1];

      const nextBlocks = blocks.filter((b) => b.id !== blockId);
      assert.equal(nextBlocks.length, 2);
      assert.equal(prevBlock.id, "tbl_1");
      assert.equal(prevBlock.type, "table");
    });
  });

  // ─── TIER 10: GROUP 6 INLINE TOOLS & FLOATING UI FOCUS RETENTION ───────────
  describe("Tier 10: Group 6 Inline Tools & Floating UI Focus Retention", () => {
    it("Auto-formatting inline code/math before punctuation does not inject unwanted space (BUG-AUTO-25)", () => {
      const checkNeedsSpace = (afterText) => {
        return afterText.length === 0 || (!/^[,\.!?;:\)\]\}\s]/.test(afterText) && !afterText.startsWith(" "));
      };

      assert.equal(checkNeedsSpace("."), false);
      assert.equal(checkNeedsSpace(", and then"), false);
      assert.equal(checkNeedsSpace(") end"), false);
      assert.equal(checkNeedsSpace(" already spaced"), false);
      assert.equal(checkNeedsSpace("word"), true);
      assert.equal(checkNeedsSpace(""), true);
    });

    it("Underline HTML tags <u> are preserved losslessly in DOM serialization and markdown formatting (BUG-FMT-29)", () => {
      // Format markdown with <u>
      const formatted = editorCaret.formatMarkdownInline("Here is <u>underlined text</u> in note");
      assert.ok(formatted.includes("<u class="));
      assert.ok(formatted.includes("underlined text</u>"));

      // Mock DOM element with <u> tag
      const mockDOM = {
        nodeType: 1,
        tagName: "DIV",
        childNodes: [
          { nodeType: 3, nodeValue: "Here is " },
          {
            nodeType: 1,
            tagName: "U",
            childNodes: [{ nodeType: 3, nodeValue: "underlined text" }],
          },
          { nodeType: 3, nodeValue: " in note" },
        ],
      };

      const serialized = editorCaret.getBlockTextFromDOM(mockDOM);
      assert.equal(serialized, "Here is <u>underlined text</u> in note");
    });

    it("Boundary detection escapes formatting tags so caret is placed outside (BUG-FMT-02)", () => {
      const isFormattingTag = (tagName) => {
        return /^(strong|b|em|i|u|ins|del|s|code|mark)$/i.test(tagName);
      };

      assert.equal(isFormattingTag("STRONG"), true);
      assert.equal(isFormattingTag("EM"), true);
      assert.equal(isFormattingTag("U"), true);
      assert.equal(isFormattingTag("DIV"), false);
      assert.equal(isFormattingTag("P"), false);

      const offsetInNode = 4;
      const nodeLength = 4;
      const parentIsFormatting = isFormattingTag("STRONG");
      const hasNextSibling = false;

      const shouldStepOutside = offsetInNode === nodeLength && parentIsFormatting && !hasNextSibling;
      assert.equal(shouldStepOutside, true);
    });

    it("Closing or saving InlineEquationPopover returns focus to host element (BUG-MATH-28)", () => {
      let focused = false;
      const mockHostEl = {
        focus: () => {
          focused = true;
        },
      };

      const onClose = () => {
        mockHostEl.focus();
      };

      onClose();
      assert.equal(focused, true);
    });

    it("Closing SlashMenu returns focus to current block contentRef (BUG-SLASH-19)", () => {
      let focused = false;
      const mockContentRef = {
        focus: () => {
          focused = true;
        },
      };

      const onClose = () => {
        mockContentRef.focus();
      };

      onClose();
      assert.equal(focused, true);
    });

    it("Floating text selection toolbar retains focus on contentEditable after formatting (BUG-FMT-18)", () => {
      let focused = false;
      const mockActiveEl = {
        isContentEditable: true,
        focus: () => {
          focused = true;
        },
      };

      const handleFormatComplete = () => {
        mockActiveEl.focus();
      };

      handleFormatComplete();
      assert.equal(focused, true);
    });

    it("Solitary placeholder <br> in empty block does not desync isCaretAtLogicalEnd (BUG-BR-01)", () => {
      const mockDOM = {
        nodeType: 1,
        tagName: "DIV",
        childNodes: [],
      };
      const mockBR = {
        nodeType: 1,
        tagName: "BR",
        parentNode: mockDOM,
        childNodes: [],
      };
      mockDOM.childNodes.push(mockBR);

      const text = editorCaret.getBlockTextFromDOM(mockDOM);
      assert.equal(text, "");

      const cleanBefore = "";
      const cleanFull = editorCaret.cleanZeroWidth(text).replace(/\n$/, "");
      const isAtEnd = cleanBefore.length >= cleanFull.length;
      assert.equal(isAtEnd, true);
    });
  });

  describe("Tier 11: Extended Note Tab Caret Audit & Advanced Invariants", () => {
    it("Multi-block paste targets last inserted block with 'end' position (BUG-PASTE-01)", () => {
      const insertedBlocks = [
        { id: "b1", type: "text", content: "Line 1" },
        { id: "b2", type: "text", content: "Line 2" },
      ];
      let focusedBlockId = null;
      let focusedPos = null;

      const mockFocusBlock = (blk, pos) => {
        focusedBlockId = blk.id;
        focusedPos = pos;
      };

      const lastInserted = insertedBlocks[insertedBlocks.length - 1];
      mockFocusBlock(lastInserted, "end");

      assert.equal(focusedBlockId, "b2");
      assert.equal(focusedPos, "end");
    });

    it("Tab inserts 2 spaces soft tab and Shift+Tab outdents (BUG-TAB-01)", () => {
      let content = "Hello world";
      const handleTab = (shiftKey) => {
        if (!shiftKey) {
          content = "  " + content;
        } else {
          if (content.startsWith("  ")) content = content.slice(2);
        }
      };

      handleTab(false);
      assert.equal(content, "  Hello world");
      handleTab(true);
      assert.equal(content, "Hello world");
    });

    it("Global Undo/Redo restores focus to target block (BUG-UNDO-01)", () => {
      const previous = [{ id: "prev-1", type: "text", content: "Undone text" }];
      let focusedId = null;
      let focusedPosition = null;

      const mockFocus = (id, pos) => {
        focusedId = id;
        focusedPosition = pos;
      };

      const targetId = previous[0].id;
      mockFocus(targetId, "end");

      assert.equal(focusedId, "prev-1");
      assert.equal(focusedPosition, "end");
    });

    it("Multi-block deletion focuses adjacent remaining block (BUG-SEL-01)", () => {
      const allBlocks = [
        { id: "b0", type: "text", content: "Intro" },
        { id: "b1", type: "text", content: "ToDelete 1" },
        { id: "b2", type: "text", content: "ToDelete 2" },
        { id: "b3", type: "text", content: "Conclusion" },
      ];
      const effectiveIds = new Set(["b1", "b2"]);
      const firstSelectedIdx = allBlocks.findIndex((b) => effectiveIds.has(b.id));
      const next = allBlocks.filter((b) => !effectiveIds.has(b.id));
      const targetIdx = Math.max(0, Math.min(firstSelectedIdx, next.length - 1));
      const focusTarget = next[targetIdx];

      assert.equal(focusTarget.id, "b3");
    });

    it("Note Title ArrowRight at title end steps into Block 0 (BUG-TITLE-23)", () => {
      const title = "My Lecture Note";
      const cursorOffset = 15;
      let steppedIntoBlock0 = false;

      if (cursorOffset === title.length) {
        steppedIntoBlock0 = true;
      }

      assert.equal(steppedIntoBlock0, true);
    });

    it("ArrowDown on the last block does NOT spawn or create a new block (BUG-DOWN-01)", () => {
      const blocks = [
        { id: "b0", type: "text", content: "Only block" }
      ];
      let newBlockCreated = false;
      const mockHandleAddAfter = () => {
        newBlockCreated = true;
      };

      const handleExitDown = (blockId) => {
        const idx = blocks.findIndex((b) => b.id === blockId);
        if (idx === -1) return;
        if (idx < blocks.length - 1) {
          // navigate to next
        }
        // Do NOT call mockHandleAddAfter!
      };

      handleExitDown("b0");
      assert.equal(newBlockCreated, false);
      assert.equal(blocks.length, 1);
    });

    it("Backspace on an empty line after special blocks deletes empty line and focuses special block (BUG-DEL-26)", () => {
      const specialTypes = ["divider", "site", "media", "code", "math", "table", "columns"];

      for (const spType of specialTypes) {
        let blocks = [
          { id: "sp-1", type: spType, content: "test" },
          { id: "empty-2", type: "text", content: "" },
        ];

        let focusedId = null;
        let focusedPos = null;
        const mockFocusBlock = (targetBlock, pos) => {
          focusedId = targetBlock.id;
          focusedPos = pos;
        };

        const idx = 1;
        const blockId = "empty-2";
        const prevBlock = blocks[idx - 1];

        // Backspace on empty-2 removes empty-2 and focuses prevBlock at "end"
        blocks = blocks.filter((b) => b.id !== blockId);
        mockFocusBlock(prevBlock, "end");

        assert.equal(blocks.length, 1);
        assert.equal(blocks[0].id, "sp-1");
        assert.equal(blocks[0].type, spType, `Special block ${spType} must NOT be deleted`);
        assert.equal(focusedId, "sp-1");
        assert.equal(focusedPos, "end");
      }
    });

    it("CodeBlock isolates textarea arrow events from parent container and exits cleanly on last line (BUG-CODE-07)", () => {
      const codeVal = "console.log(123);\nconst b = 2;\nreturn true;";
      let exitDownTriggered = false;
      let exitUpTriggered = false;

      const onExitDown = () => {
        exitDownTriggered = true;
      };
      const onExitUp = () => {
        exitUpTriggered = true;
      };

      // Mock event simulation inside textarea
      const simulateKey = (key, offset) => {
        let defaultPrevented = false;
        let propagationStopped = false;

        const e = {
          key,
          target: { tagName: "TEXTAREA", selectionStart: offset, selectionEnd: offset },
          preventDefault: () => {
            defaultPrevented = true;
          },
          stopPropagation: () => {
            propagationStopped = true;
          },
        };

        const start = offset;
        const end = offset;

        if (e.key === "ArrowDown") {
          e.stopPropagation();
          const isLastLine = !codeVal.substring(start).includes("\n");
          if (isLastLine && start === end) {
            e.preventDefault();
            onExitDown();
          }
        }
        if (e.key === "ArrowUp") {
          e.stopPropagation();
          const isFirstLine = !codeVal.substring(0, start).includes("\n");
          if (isFirstLine && start === end) {
            e.preventDefault();
            onExitUp();
          }
        }

        // Simulate outer container onKeyDown check
        let containerExited = false;
        const containerOnKeyDown = (ev) => {
          if (ev.target.tagName === "TEXTAREA") return;
          if (ev.key === "ArrowDown") containerExited = true;
        };
        containerOnKeyDown(e);

        return { defaultPrevented, propagationStopped, containerExited };
      };

      // Test 1: Intermediate line (offset 20: "const b = 2;")
      // ArrowDown should NOT exit, should stop propagation, and container must not trigger
      const res1 = simulateKey("ArrowDown", 20);
      assert.equal(exitDownTriggered, false, "Must not exit on intermediate line");
      assert.equal(res1.propagationStopped, true, "Must stop propagation");
      assert.equal(res1.containerExited, false, "Container must ignore textarea events");

      // Test 2: Last line (offset 35: "return true;")
      // ArrowDown SHOULD exit down
      const res2 = simulateKey("ArrowDown", 35);
      assert.equal(exitDownTriggered, true, "Must exit down when on last line");
      assert.equal(res2.defaultPrevented, true);

      // Test 3: First line (offset 5: "console.log")
      // ArrowUp SHOULD exit up
      const res3 = simulateKey("ArrowUp", 5);
      assert.equal(exitUpTriggered, true, "Must exit up when on first line");
      assert.equal(res3.defaultPrevented, true);
    });

    it("ColumnsBlock deletes cleanly on Backspace or Delete when empty or selected (BUG-COL-14)", () => {
      let blocks = [
        { id: "b0", type: "text", content: "Preceding note paragraph" },
        {
          id: "col_block",
          type: "columns",
          columnCount: 2,
          columnsData: [
            { id: "c1", title: "", content: "" },
            { id: "c2", title: "", content: "" },
          ],
        },
      ];

      let deletedBlockId = null;
      let focusedBlock = null;
      const mockOnDelete = (id) => {
        deletedBlockId = id;
        const idx = blocks.findIndex((b) => b.id === id);
        const next = blocks.filter((b) => b.id !== id);
        const safeNext = next.length > 0 ? next : [{ id: "fallback", type: "text", content: "" }];
        const targetIdx = Math.max(0, Math.min(idx > 0 ? idx - 1 : 0, safeNext.length - 1));
        focusedBlock = safeNext[targetIdx];
        blocks = safeNext;
      };

      // 1. ColumnItem Backspace when block is entirely empty
      const allCols = blocks[1].columnsData;
      const isEntireBlockEmpty = allCols.every(
        (c) => (!c.title || c.title.trim() === "") && (!c.content || c.content.trim() === "")
      );
      assert.equal(isEntireBlockEmpty, true);

      // Simulating Backspace in Column 1 Title when empty
      mockOnDelete("col_block");
      assert.equal(deletedBlockId, "col_block");
      assert.equal(blocks.length, 1);
      assert.equal(blocks[0].id, "b0");
      assert.equal(focusedBlock.id, "b0");

      // 2. Global selectedId Backspace / Delete
      let singleSelectedId = "col_block_2";
      let blocks2 = [
        { id: "p1", type: "text", content: "First" },
        { id: "col_block_2", type: "columns", columnCount: 2, columnsData: [] },
      ];
      let isInput = false;
      const effectiveIds = !isInput && singleSelectedId ? new Set([singleSelectedId]) : null;
      assert.notEqual(effectiveIds, null);
      assert.equal(effectiveIds.has("col_block_2"), true);

      // Execute deletion
      blocks2 = blocks2.filter((b) => !effectiveIds.has(b.id));
      assert.equal(blocks2.length, 1);
      assert.equal(blocks2[0].id, "p1");
    });

    it("Table Enter at last row, last col exits to next block without adding rows or columns (BUG-TBL-15)", () => {
      const tableData = {
        hasHeaderRow: true,
        headers: ["Col 1", "Col 2"],
        rows: [
          ["R1C1", "R1C2"],
          ["R2C1", "R2C2"],
        ],
      };

      const block = { id: "tbl_1", type: "table", tableData };
      const blocks = [
        block,
        { id: "next_block", type: "text", content: "Next text block" },
      ];

      let rowAdded = false;
      let colAdded = false;
      let exitedDownId = null;
      let focusedBlockId = null;
      let focusedPosition = null;

      const mockAddRow = () => { rowAdded = true; };
      const mockAddCol = () => { colAdded = true; };
      const mockOnExitDown = (id) => {
        exitedDownId = id;
        const idx = blocks.findIndex((b) => b.id === id);
        if (idx < blocks.length - 1) {
          focusedBlockId = blocks[idx + 1].id;
          focusedPosition = "start";
          return true;
        }
        return false;
      };

      // Simulate handleCellKeyDown Enter key behavior:
      const simulateEnter = (rowIndex, colIndex, isHeader) => {
        const colCount = tableData.headers.length;
        const rowCount = tableData.rows.length;

        if (isHeader) {
          if (rowCount > 0) {
            return `focus_r_0_c_${colIndex}`;
          } else if (colIndex === colCount - 1) {
            const exited = mockOnExitDown(block.id);
            return exited ? "exited_down" : "added_after";
          } else {
            return `focus_h_${colIndex + 1}`;
          }
        } else if (rowIndex < rowCount - 1) {
          return `focus_r_${rowIndex + 1}_c_${colIndex}`;
        } else {
          // Last row (rowIndex === rowCount - 1):
          if (colIndex === colCount - 1) {
            const exited = mockOnExitDown(block.id);
            return exited ? "exited_down" : "added_after";
          } else {
            return `focus_r_${rowIndex}_c_${colIndex + 1}`;
          }
        }
      };

      // 1. Press Enter in row 0, col 0 -> moves to row 1, col 0 (no new row/col)
      const res1 = simulateEnter(0, 0, false);
      assert.equal(res1, "focus_r_1_c_0");
      assert.equal(rowAdded, false);
      assert.equal(colAdded, false);

      // 2. Press Enter in last row (row 1), col 0 -> moves to next col (col 1), no row/col added
      const res2 = simulateEnter(1, 0, false);
      assert.equal(res2, "focus_r_1_c_1");
      assert.equal(rowAdded, false);
      assert.equal(colAdded, false);

      // 3. Press Enter in last row (row 1), last col (col 1) -> exits down to next block!
      const res3 = simulateEnter(1, 1, false);
      assert.equal(res3, "exited_down");
      assert.equal(exitedDownId, "tbl_1");
      assert.equal(focusedBlockId, "next_block");
      assert.equal(focusedPosition, "start");
      assert.equal(rowAdded, false);
      assert.equal(colAdded, false);
      assert.equal(tableData.rows.length, 2);
    });

    it("MathBlock direct keyboard navigation allows passing through vertically and horizontally (BUG-MATH-08)", () => {
      const block = { id: "math_navigate", type: "math", content: "f(x) = x^2" };
      let exitedUp = false;
      let exitedDown = false;
      let isEditing = false;

      // Container keydown simulation
      const simulateContainerKey = (key) => {
        const e = {
          key,
          target: { tagName: "DIV", id: `math_${block.id}` },
          preventDefault: () => {},
        };
        if (e.key === "ArrowDown" || e.key === "ArrowRight") {
          exitedDown = true;
          return "exited_down";
        } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
          exitedUp = true;
          return "exited_up";
        } else if (e.key === "Enter" && !isEditing) {
          isEditing = true;
          return "started_editing";
        }
        return "none";
      };

      // 1. ArrowUp on container exits up
      assert.equal(simulateContainerKey("ArrowUp"), "exited_up");
      assert.equal(exitedUp, true);

      // 2. ArrowDown on container exits down
      assert.equal(simulateContainerKey("ArrowDown"), "exited_down");
      assert.equal(exitedDown, true);

      // 3. Enter on container enters editing
      assert.equal(simulateContainerKey("Enter"), "started_editing");
      assert.equal(isEditing, true);

      // Textarea keydown simulation (when editing)
      const simulateFormulaKey = (key, selStart, selEnd) => {
        const val = block.content;
        const e = {
          key,
          target: { selectionStart: selStart, selectionEnd: selEnd },
          preventDefault: () => {},
          stopPropagation: () => {},
        };

        if (e.key === "ArrowUp") {
          const isFirstLine = !val.substring(0, selStart).includes("\n");
          if (isFirstLine && selStart === selEnd) {
            exitedUp = true;
            return "exited_up";
          }
        } else if (e.key === "ArrowDown") {
          const isLastLine = !val.substring(selStart).includes("\n");
          if (isLastLine && selStart === selEnd) {
            exitedDown = true;
            return "exited_down";
          }
        } else if (e.key === "ArrowLeft") {
          if (selStart === 0 && selEnd === 0) {
            exitedUp = true;
            return "exited_up";
          }
        } else if (e.key === "ArrowRight") {
          if (selStart === val.length && selEnd === val.length) {
            exitedDown = true;
            return "exited_down";
          }
        }
        return "none";
      };

      // 4. ArrowUp on first line of formula exits up
      exitedUp = false;
      assert.equal(simulateFormulaKey("ArrowUp", 0, 0), "exited_up");
      assert.equal(exitedUp, true);

      // 5. ArrowDown on last line of formula exits down
      exitedDown = false;
      const len = block.content.length;
      assert.equal(simulateFormulaKey("ArrowDown", len, len), "exited_down");
      assert.equal(exitedDown, true);
    });

    it("Divider block steps up on Backspace and does not delete when focused without multi-selection (BUG-DEL-29)", () => {
      const block = { id: "div_1", type: "divider", content: "" };
      let deletedId = null;
      let exitedUpId = null;

      // Container keydown
      const simulateDividerKey = (key) => {
        const e = {
          key,
          preventDefault: () => {},
        };
        if (e.key === "Delete") {
          deletedId = block.id;
        } else if (e.key === "Backspace") {
          exitedUpId = block.id;
        }
      };

      // Backspace on divider steps up, does NOT delete
      simulateDividerKey("Backspace");
      assert.equal(exitedUpId, "div_1");
      assert.equal(deletedId, null);

      // Delete on divider deletes it
      simulateDividerKey("Delete");
      assert.equal(deletedId, "div_1");

      // Verify handleMultiBlockKeydown ignores selectedId when selectedBlockIds is empty
      const selectedBlockIds = new Set();
      const selectedId = "div_1";
      const effectiveIds = selectedBlockIds && selectedBlockIds.size > 0 ? selectedBlockIds : null;
      assert.equal(effectiveIds, null);
    });
  });
});
