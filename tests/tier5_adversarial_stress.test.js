/**
 * ═════════════════════════════════════════════════════════════════════════════
 * SocraticOS — Tier 5 Final Adversarial Stress Testing & Coverage Hardening
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Objectives:
 * - White-box stress scenarios for F1–F7:
 *   1. Pathological line splitting across list items, headings, formulas, and nested spans.
 *   2. Backspace merging at offset 0 across diverse block types and KaTeX pills.
 *   3. Bottom whitespace click focus idempotency, lock guards, and append rules.
 *   4. Zero-width unicode persistence sanitization across storage and export pipelines.
 *   5. Arrow navigation & pill boundary traversal under high-density fuzzing (5,000 ops).
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import katex from "katex";
import {
  cleanZeroWidth,
  formatMarkdownInline,
  setBlockDOMFromText,
  tryAutoFormatInlineCode,
  tryAutoFormatInlineMath,
  handleInlineBoundaryKeyDown,
  setCaretToEnd,
  setCaretToStart,
  getDOMCaretLength,
  setCaretAtOffset,
  isCaretAtLogicalStart,
  isCaretAtBlockStart,
  isCaretAtLogicalEnd,
  isCaretAtBlockEnd,
  isCaretOnFirstVisualLine,
  isCaretOnLastVisualLine,
  getBlockTextFromDOM,
  splitBlockDOMAtRange,
  getSerializedTextFromRange,
} from "../lib/editorCaret.js";

import {
  blocksToMarkdownLossy,
  tryParseMarkdownToBlocks,
  blocksToHTMLLossy,
  blocksToPlainText,
  tryParsePlainTextToBlocks,
} from "../lib/exportImport.js";
import { editorBlocksToText, extractHeadingsFromBlocks } from "../lib/blocks.js";

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

  get firstChild() {
    return this.childNodes[0] || null;
  }

  get lastChild() {
    return this.childNodes[this.childNodes.length - 1] || null;
  }

  appendChild(child) {
    if (child.nodeType === 11 /* DocumentFragment */) {
      while (child.childNodes.length > 0) {
        this.appendChild(child.childNodes[0]);
      }
      return child;
    }
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
      if (cls) this.classes.delete(cls);
    }
    this._sync();
  }

  contains(cls) {
    return this.classes.has(cls);
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
    this._isFocused = false;
    this._listeners = {};
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
    return { top: 100, bottom: 130, left: 50, right: 750, width: 700, height: 30, x: 50, y: 100 };
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

  cloneContents() {
    const frag = new MockDocumentFragment();
    if (!this.startContainer || !this.endContainer) return frag;

    if (this.startContainer === this.endContainer) {
      if (this.startContainer.nodeType === 3) {
        const txt = this.startContainer.nodeValue.substring(this.startOffset, this.endOffset);
        frag.appendChild(new MockTextNode(txt));
        return frag;
      }
      if (this.startContainer.nodeType === 1) {
        for (let i = this.startOffset; i < this.endOffset; i++) {
          if (this.startContainer.childNodes[i]) {
            frag.appendChild(this.startContainer.childNodes[i].cloneNode(true));
          }
        }
        return frag;
      }
    }

    // Find common ancestor
    let ancestor = this.startContainer;
    while (ancestor && !ancestor.contains(this.endContainer)) {
      ancestor = ancestor.parentNode;
    }
    if (!ancestor) ancestor = this.startContainer.parentNode || this.startContainer;

    // Helper: clone branch from (startContainer, startOffset) to the end of node
    const cloneStartBranch = (node) => {
      if (node.nodeType === 3) {
        if (node === this.startContainer) {
          return new MockTextNode(node.nodeValue.substring(this.startOffset));
        }
        return node.cloneNode(true);
      }
      if (node.nodeType === 1) {
        const clone = new MockElement(node.tagName);
        for (const [k, v] of Object.entries(node.attributes)) {
          clone.setAttribute(k, v);
        }
        let foundStart = false;
        for (let i = 0; i < node.childNodes.length; i++) {
          const child = node.childNodes[i];
          if (node === this.startContainer && i === this.startOffset) {
            foundStart = true;
          }
          if (child === this.startContainer || child.contains(this.startContainer)) {
            clone.appendChild(cloneStartBranch(child));
            foundStart = true;
            continue;
          }
          if (foundStart) {
            clone.appendChild(child.cloneNode(true));
          }
        }
        return clone;
      }
      return node.cloneNode(true);
    };

    // Helper: clone branch from start of node up to (endContainer, endOffset)
    const cloneEndBranch = (node) => {
      if (node.nodeType === 3) {
        if (node === this.endContainer) {
          return new MockTextNode(node.nodeValue.substring(0, this.endOffset));
        }
        return node.cloneNode(true);
      }
      if (node.nodeType === 1) {
        const clone = new MockElement(node.tagName);
        for (const [k, v] of Object.entries(node.attributes)) {
          clone.setAttribute(k, v);
        }
        for (let i = 0; i < node.childNodes.length; i++) {
          const child = node.childNodes[i];
          if (node === this.endContainer && i === this.endOffset) {
            break;
          }
          if (child === this.endContainer || child.contains(this.endContainer)) {
            clone.appendChild(cloneEndBranch(child));
            break;
          }
          clone.appendChild(child.cloneNode(true));
        }
        return clone;
      }
      return node.cloneNode(true);
    };

    // Iterate over ancestor's children between startContainer branch and endContainer branch
    let state = 0; // 0 = before start, 1 = within range, 2 = after end
    for (let i = 0; i < ancestor.childNodes.length; i++) {
      const child = ancestor.childNodes[i];

      if (ancestor === this.startContainer && i === this.startOffset) {
        state = 1;
      }

      const isStartChild = child === this.startContainer || child.contains(this.startContainer);
      const isEndChild = child === this.endContainer || child.contains(this.endContainer);

      if (ancestor === this.endContainer && i === this.endOffset) {
        state = 2;
        break;
      }

      if (isStartChild && isEndChild) {
        // Both start and end are inside this child
        // (should not happen if ancestor is lowest common ancestor, but handle safely)
        const subRange = new MockRange();
        subRange.setStart(this.startContainer, this.startOffset);
        subRange.setEnd(this.endContainer, this.endOffset);
        frag.appendChild(subRange.cloneContents());
        state = 2;
        break;
      } else if (isStartChild) {
        frag.appendChild(cloneStartBranch(child));
        state = 1;
      } else if (isEndChild) {
        frag.appendChild(cloneEndBranch(child));
        state = 2;
        break;
      } else if (state === 1) {
        frag.appendChild(child.cloneNode(true));
      }
    }

    return frag;
  }

  _checkCollapsed() {
    this.collapsed =
      this.startContainer === this.endContainer && this.startOffset === this.endOffset;
  }

  getBoundingClientRect() {
    return { top: 100, bottom: 130, left: 50, right: 750, width: 700, height: 30, x: 50, y: 100 };
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

// Global attachment
const mockDoc = {
  createElement: (tagName) => new MockElement(tagName),
  createTextNode: (text) => new MockTextNode(text),
  createRange: () => new MockRange(),
  createTreeWalker: (root, whatToShow, filter) => new MockTreeWalker(root, whatToShow, filter),
  getElementById: () => null,
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

// ─── 2. SIMULATED BLOCK NOTE EDITOR HARNESS ──────────────────────────────────

class StressEditorHarness {
  constructor(initialBlocks = [{ id: "b1", type: "text", content: "" }]) {
    this.blocks = JSON.parse(JSON.stringify(initialBlocks));
    this.selectedId = this.blocks[0]?.id || null;
    this.domMap = new Map();
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

    if (handleInlineBoundaryKeyDown(e)) {
      this.syncStateFromDOM(blockId);
      return;
    }

    // ENTER SPLITTING
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const sel = window.getSelection();
      let textBefore = block.content || "";
      let textAfter = "";

      if (sel && sel.rangeCount > 0 && el.contains(sel.focusNode)) {
        const split = splitBlockDOMAtRange(el, sel.getRangeAt(0));
        textBefore = split.textBefore;
        textAfter = split.textAfter;
      }

      // Empty formatted block -> unlist to text
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

      // Headings, callouts, quotes spawn text block below
      const nextType = ["h1", "h2", "h3", "h4", "callout", "quote"].includes(block.type)
        ? "text"
        : block.type;

      // Clean redundant leading bullet markers
      if (["bullet", "number", "todo"].includes(nextType)) {
        textAfter = textAfter.replace(/^(\*|-|\u2022|\d+\.|\[[ xX]?\])\s+/, "");
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
      let isAtStart = isCaretAtLogicalStart(el);
      if (!isAtStart) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && sel.focusNode) {
          const range = sel.getRangeAt(0);
          if (range.collapsed) {
            const split = splitBlockDOMAtRange(el, range);
            if (cleanZeroWidth(split.textBefore).length === 0) {
              isAtStart = true;
            }
          }
        }
      }

      // 1. Delete standalone blocks
      const standaloneEmbedTypes = ["divider", "site", "media", "canvas"];
      if (isAtStart && idx > 0 && standaloneEmbedTypes.includes(this.blocks[idx - 1]?.type)) {
        e.preventDefault();
        const removed = this.blocks.splice(idx - 1, 1)[0];
        this.domMap.delete(removed.id);
        return;
      }

      // 2. Unlist formatted block
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
          const domCaretOffset = prevEl ? getDOMCaretLength(prevEl) : prevContent.length;

          prevBlock.content = mergedContent;
          setBlockDOMFromText(prevEl, mergedContent, prevBlock.type);

          this.blocks.splice(idx, 1);
          this.domMap.delete(block.id);

          this.selectedId = prevBlock.id;
          setCaretAtOffset(prevEl, domCaretOffset);
          return;
        }
      }
    }

    // ARROWS
    if (e.key === "ArrowUp") {
      if (e.altKey || isCaretAtLogicalStart(el)) {
        e.preventDefault();
        if (idx > 0) {
          let targetIdx = idx - 1;
          while (targetIdx >= 0 && this.blocks[targetIdx].type === "divider") targetIdx--;
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
          while (targetIdx < this.blocks.length && this.blocks[targetIdx].type === "divider") targetIdx++;
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

  handleBottomWhitespaceClick() {
    if (this.isLocked) return;
    if (!this.clickToAppend) return;

    if (this.blocks.length === 0) {
      this._appendEmptyBlockAndFocus();
      return;
    }

    const lastBlock = this.blocks[this.blocks.length - 1];
    if (!lastBlock || lastBlock.type !== "text" || (lastBlock.content !== "" && lastBlock.content !== undefined)) {
      this._appendEmptyBlockAndFocus();
    } else {
      this.selectedId = lastBlock.id;
      const el = this.getDOM(lastBlock.id);
      setCaretToEnd(el);
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. TIER 5 ADVERSARIAL STRESS TEST SUITES
// ═════════════════════════════════════════════════════════════════════════════

describe("Tier 5 Final Adversarial Stress & Hardening Suite", () => {

  describe("Suite 1: Pathological Line Splitting Stress (F4)", () => {

    it("ST-101: Splits across all block types (h1-h4, bullet, number, todo, quote, callout) with exact type inheritance", () => {
      const typesToTest = [
        { type: "h1", expectedNext: "text" },
        { type: "h2", expectedNext: "text" },
        { type: "h3", expectedNext: "text" },
        { type: "h4", expectedNext: "text" },
        { type: "bullet", expectedNext: "bullet" },
        { type: "number", expectedNext: "number" },
        { type: "todo", expectedNext: "todo" },
        { type: "quote", expectedNext: "text" },
        { type: "callout", expectedNext: "text" },
      ];

      for (const { type, expectedNext } of typesToTest) {
        const editor = new StressEditorHarness([
          { id: "b1", type, content: "LeftPart and RightPart", checked: true },
        ]);
        const el = editor.getDOM("b1");
        
        // Place caret at position 8 ("LeftPart")
        setCaretAtOffset(el, 8);
        const event = new MockEvent("keydown", { key: "Enter" });
        editor.handleKeyDown(event, "b1");

        assert.equal(editor.blocks.length, 2, `Splitting ${type} should produce 2 blocks`);
        assert.equal(editor.blocks[0].content, "LeftPart", `First block content mismatch for ${type}`);
        assert.equal(editor.blocks[0].type, type, `First block type should remain ${type}`);
        assert.equal(editor.blocks[1].content, " and RightPart", `Second block content mismatch for ${type}`);
        assert.equal(editor.blocks[1].type, expectedNext, `Second block type mismatch for ${type}`);

        if (type === "todo") {
          assert.equal(editor.blocks[0].checked, true, "Original todo should maintain checked state");
          assert.equal(editor.blocks[1].checked, false, "New todo block must spawn unchecked");
        }
      }
    });

    it("ST-102: Split line containing nested formatting: **bold _italic $E=mc^2$ `code`_** without character/word loss", () => {
      const content = "Prefix **bold _italic $E=mc^2$ `code`_** Suffix";

      // Split at various character offsets (0, 7, 15, 25, content.length)
      for (const splitOffset of [0, 7, 15, 25, content.length]) {
        const tempEditor = new StressEditorHarness([
          { id: "b1", type: "text", content },
        ]);
        const tempEl = tempEditor.getDOM("b1");
        setCaretAtOffset(tempEl, splitOffset);

        const event = new MockEvent("keydown", { key: "Enter" });
        tempEditor.handleKeyDown(event, "b1");

        const block1Text = tempEditor.blocks[0].content;
        const block2Text = tempEditor.blocks[1].content;

        // Verify both blocks form valid standalone blocks
        assert.ok(typeof block1Text === "string");
        assert.ok(typeof block2Text === "string");

        // Verify plain-text words and math tokens are completely preserved without dropping characters
        const plainOrig = cleanZeroWidth(content).replace(/[*_~=`]/g, "");
        const plainSplit = cleanZeroWidth(block1Text + block2Text).replace(/[*_~=`]/g, "");
        assert.equal(
          plainSplit,
          plainOrig,
          `Plain text and formulas across split blocks at offset ${splitOffset} must preserve all words`
        );
      }
    });

    it("ST-103: Pressing Enter on an empty list/callout block un-lists it to text in-place without spawning a block", () => {
      const formattedTypes = ["bullet", "number", "todo", "quote", "callout", "toggle"];
      for (const type of formattedTypes) {
        const editor = new StressEditorHarness([
          { id: "b1", type, content: "" },
        ]);
        const el = editor.getDOM("b1");
        setCaretToStart(el);

        const event = new MockEvent("keydown", { key: "Enter" });
        editor.handleKeyDown(event, "b1");

        assert.equal(editor.blocks.length, 1, `Un-listing empty ${type} must not spawn a new block`);
        assert.equal(editor.blocks[0].type, "text", `Empty ${type} must convert to plain text`);
        assert.equal(editor.blocks[0].content, "");
      }
    });

    it("ST-104: Split with leading bullet marks strips duplicated bullet symbols cleanly from textAfter", () => {
      const bulletInputs = [
        { type: "bullet", content: "* Item alpha", expectedAfter: "Item alpha" },
        { type: "bullet", content: "- Item beta", expectedAfter: "Item beta" },
        { type: "bullet", content: "• Item gamma", expectedAfter: "Item gamma" },
        { type: "number", content: "1. Numbered item", expectedAfter: "Numbered item" },
        { type: "number", content: "99. High number", expectedAfter: "High number" },
        { type: "todo", content: "[ ] Todo unchecked", expectedAfter: "Todo unchecked" },
        { type: "todo", content: "[x] Todo checked", expectedAfter: "Todo checked" },
      ];

      for (const { type, content, expectedAfter } of bulletInputs) {
        const editor = new StressEditorHarness([
          { id: "b1", type, content },
        ]);
        const el = editor.getDOM("b1");
        // Split at start of text content
        setCaretToStart(el);
        const event = new MockEvent("keydown", { key: "Enter" });
        editor.handleKeyDown(event, "b1");

        assert.equal(editor.blocks.length, 2);
        assert.equal(editor.blocks[1].content, expectedAfter, `Leading bullet tokens must be stripped from ${content}`);
      }
    });
  });

  describe("Suite 2: Adversarial Backspace & Delete Merging Stress (F5)", () => {

    it("ST-201: Backspace merging from offset 0 into all previous block types with exact caret offset calculation", () => {
      const targetTypes = ["text", "h1", "h2", "h3", "h4", "bullet", "number", "todo", "quote", "callout"];
      for (const prevType of targetTypes) {
        const prevContent = `Heading/Item ${prevType}`;
        const currContent = " Appended line";
        const editor = new StressEditorHarness([
          { id: "b1", type: prevType, content: prevContent },
          { id: "b2", type: "text", content: currContent },
        ]);

        const el2 = editor.getDOM("b2");
        setCaretToStart(el2);

        const event = new MockEvent("keydown", { key: "Backspace" });
        editor.handleKeyDown(event, "b2");

        assert.equal(editor.blocks.length, 1, `Merge into ${prevType} should result in 1 block`);
        assert.equal(editor.blocks[0].id, "b1");
        assert.equal(editor.blocks[0].type, prevType);
        assert.equal(editor.blocks[0].content, prevContent + currContent);
        assert.equal(editor.selectedId, "b1");
      }
    });

    it("ST-202: Backspace merging into previous block ending with KaTeX formula pill ($x^2$) ignores KaTeX internal DOM expansion", () => {
      const prevContent = "Energy formula $E=mc^2$";
      const currContent = " and more text";
      const editor = new StressEditorHarness([
        { id: "b1", type: "text", content: prevContent },
        { id: "b2", type: "text", content: currContent },
      ]);

      const prevEl = editor.getDOM("b1");
      const domLength = getDOMCaretLength(prevEl);
      assert.equal(domLength, prevContent.length, "getDOMCaretLength must match logical formula length, not KaTeX HTML DOM length");

      const el2 = editor.getDOM("b2");
      setCaretToStart(el2);

      const event = new MockEvent("keydown", { key: "Backspace" });
      editor.handleKeyDown(event, "b2");

      assert.equal(editor.blocks.length, 1);
      assert.equal(editor.blocks[0].content, prevContent + currContent);
    });

    it("ST-203: Backspace at offset 0 after standalone block (divider, site, media, canvas) deletes standalone block without merging", () => {
      const standaloneTypes = ["divider", "site", "media", "canvas"];
      for (const type of standaloneTypes) {
        const editor = new StressEditorHarness([
          { id: "b1", type: "text", content: "Before" },
          { id: "b2", type, content: "" },
          { id: "b3", type: "text", content: "After" },
        ]);

        const el3 = editor.getDOM("b3");
        setCaretToStart(el3);

        const event = new MockEvent("keydown", { key: "Backspace" });
        editor.handleKeyDown(event, "b3");

        assert.equal(editor.blocks.length, 2, `Standalone ${type} must be removed`);
        assert.equal(editor.blocks[0].id, "b1");
        assert.equal(editor.blocks[0].content, "Before");
        assert.equal(editor.blocks[1].id, "b3");
        assert.equal(editor.blocks[1].content, "After");
      }
    });

    it("ST-204: Chain-merging 10 distinct blocks sequentially via Backspace yields complete verbatim text", () => {
      const initialContents = [
        "1. First $a$",
        "2. Second `code`",
        "3. Third **bold**",
        "4. Fourth _italic_",
        "5. Fifth $b^2$",
        "6. Sixth ~~del~~",
        "7. Seventh ==mark==",
        "8. Eighth [link](http://test.com)",
        "9. Ninth formula $\\alpha$",
        "10. Tenth final",
      ];

      const initialBlocks = initialContents.map((c, i) => ({
        id: `b_${i}`,
        type: i === 0 ? "h2" : "text",
        content: c,
      }));

      const editor = new StressEditorHarness(initialBlocks);

      // Sequentially merge all blocks from b_9 down to b_1 into b_0
      for (let i = initialContents.length - 1; i >= 1; i--) {
        const currId = `b_${i}`;
        const el = editor.getDOM(currId);
        setCaretToStart(el);

        const event = new MockEvent("keydown", { key: "Backspace" });
        editor.handleKeyDown(event, currId);
      }

      assert.equal(editor.blocks.length, 1, "All 10 blocks should be merged into 1 block");
      assert.equal(editor.blocks[0].id, "b_0");
      assert.equal(editor.blocks[0].type, "h2");
      assert.equal(editor.blocks[0].content, initialContents.join(""));
    });
  });

  describe("Suite 3: Bottom Whitespace Focus & Marquee Stress (F6)", () => {

    it("ST-301: Clicking bottom whitespace when document has 0 blocks initializes 1 empty block", () => {
      const editor = new StressEditorHarness([]);
      editor.handleBottomWhitespaceClick();

      assert.equal(editor.blocks.length, 1);
      assert.equal(editor.blocks[0].type, "text");
      assert.equal(editor.blocks[0].content, "");
      assert.equal(editor.selectedId, editor.blocks[0].id);
    });

    it("ST-302: Clicking bottom whitespace when last block has content creates exactly 1 new empty text block", () => {
      const editor = new StressEditorHarness([
        { id: "b1", type: "h1", content: "My Title" },
      ]);
      editor.handleBottomWhitespaceClick();

      assert.equal(editor.blocks.length, 2);
      assert.equal(editor.blocks[1].type, "text");
      assert.equal(editor.blocks[1].content, "");
      assert.equal(editor.selectedId, editor.blocks[1].id);
    });

    it("ST-303: 100 rapid sequential whitespace clicks creates at most 1 empty block (Idempotent)", () => {
      const editor = new StressEditorHarness([
        { id: "b1", type: "text", content: "Existing content" },
      ]);

      for (let i = 0; i < 100; i++) {
        editor.handleBottomWhitespaceClick();
      }

      assert.equal(editor.blocks.length, 2, "100 clicks must only create 1 new block, not 100 blocks");
      assert.equal(editor.blocks[1].content, "");
      assert.equal(editor.selectedId, editor.blocks[1].id);
    });

    it("ST-304: Clicking whitespace when isLocked=true or clickToAppend=false is strictly rejected", () => {
      const editor = new StressEditorHarness([
        { id: "b1", type: "text", content: "Read only note" },
      ]);
      editor.isLocked = true;
      editor.handleBottomWhitespaceClick();
      assert.equal(editor.blocks.length, 1, "Locked editor must not create blocks on whitespace click");

      editor.isLocked = false;
      editor.clickToAppend = false;
      editor.handleBottomWhitespaceClick();
      assert.equal(editor.blocks.length, 1, "clickToAppend=false must not create blocks on whitespace click");
    });
  });

  describe("Suite 4: Multi-Layer Zero-Width Persistence & Sanitization (F7)", () => {

    it("ST-401: cleanZeroWidth thoroughly purges all 6 zero-width variants in isolation and in dense mixtures", () => {
      const zwChars = ["\u200B", "\u200C", "\u200D", "\u2060", "\uFEFF", "\u0000"];
      for (const zw of zwChars) {
        assert.equal(cleanZeroWidth(`Hello${zw}World`), "HelloWorld");
        assert.equal(cleanZeroWidth(`${zw}${zw}${zw}`), "");
      }

      const complexZw = `\u200B$\u200Cx\u200D^2\u2060$\uFEFF \u0000text`;
      assert.equal(cleanZeroWidth(complexZw), "$x^2$ text");
    });

    it("ST-402: Export pipelines (Markdown, HTML, PlainText, AI Extraction) strip zero-width artifacts", () => {
      const dirtyBlocks = [
        { id: "b1", type: "h1", content: "\u200B# Title\uFEFF" },
        { id: "b2", type: "text", content: "Paragraph \u200Cwith $a\u200Db$ \u2060math" },
        { id: "b3", type: "bullet", content: "\u0000List item" },
      ];

      const md = blocksToMarkdownLossy(dirtyBlocks);
      const html = blocksToHTMLLossy(dirtyBlocks);
      const text = blocksToPlainText(dirtyBlocks);
      const aiText = editorBlocksToText(dirtyBlocks);

      const zwRegex = /[\u200B\u200C\u200D\u2060\uFEFF\u0000]/;
      assert.equal(zwRegex.test(md), false, "Markdown export must contain 0 zero-width characters");
      assert.equal(zwRegex.test(html), false, "HTML export must contain 0 zero-width characters");
      assert.equal(zwRegex.test(text), false, "Plain text export must contain 0 zero-width characters");
      assert.equal(zwRegex.test(aiText), false, "AI plain-text serialization must contain 0 zero-width characters");
    });
  });

  describe("Suite 5: Arrow Navigation & Fuzzing Stress (F1, F2, F3)", () => {

    it("ST-501: ArrowUp / ArrowDown skips consecutive sequence of multiple dividers", () => {
      const editor = new StressEditorHarness([
        { id: "b1", type: "text", content: "Start text" },
        { id: "b2", type: "divider", content: "" },
        { id: "b3", type: "divider", content: "" },
        { id: "b4", type: "divider", content: "" },
        { id: "b5", type: "text", content: "End text" },
      ]);

      const el1 = editor.getDOM("b1");
      setCaretToEnd(el1);

      const downEvent = new MockEvent("keydown", { key: "ArrowDown" });
      editor.handleKeyDown(downEvent, "b1");
      assert.equal(editor.selectedId, "b5", "ArrowDown must skip all 3 dividers and land on b5");

      const el5 = editor.getDOM("b5");
      setCaretToStart(el5);
      const upEvent = new MockEvent("keydown", { key: "ArrowUp" });
      editor.handleKeyDown(upEvent, "b5");
      assert.equal(editor.selectedId, "b1", "ArrowUp must skip all 3 dividers and land on b1");
    });

    it("ST-502: High-Density Fuzzing (5,000 Randomized Operations) maintains state invariant consistency", () => {
      const editor = new StressEditorHarness([
        { id: "b1", type: "h1", content: "Title block" },
        { id: "b2", type: "bullet", content: "Bullet $x^2$" },
        { id: "b3", type: "text", content: "Code `let a = 1;` here" },
      ]);

      const actions = ["ArrowUp", "ArrowDown", "Enter", "Backspace", "WhitespaceClick", "TypeMath"];

      for (let i = 0; i < 5000; i++) {
        const action = actions[Math.floor(Math.random() * actions.length)];
        const currentBlock = editor.blocks.find((b) => b.id === editor.selectedId) || editor.blocks[0];
        if (!currentBlock) {
          editor.handleBottomWhitespaceClick();
          continue;
        }

        const el = editor.getDOM(currentBlock.id);

        if (action === "WhitespaceClick") {
          editor.handleBottomWhitespaceClick();
        } else if (action === "TypeMath") {
          if (el) {
            const formula = `x_${i}`;
            currentBlock.content = (currentBlock.content || "") + ` $${formula}$`;
            editor.syncDOMFromState(currentBlock.id);
          }
        } else {
          const event = new MockEvent("keydown", { key: action });
          editor.handleKeyDown(event, currentBlock.id);
        }

        // Periodic invariant assertion
        if (i % 500 === 0) {
          assert.ok(editor.blocks.length > 0, "Editor blocks count must never drop below 1");
          assert.ok(editor.blocks.every((b) => typeof b.type === "string" && b.id), "All blocks must have valid schema");
        }
      }

      assert.ok(editor.blocks.length > 0, "Editor survived 5,000 randomized operations successfully");
    });

    it("ST-503: Rapid alternating ArrowLeft / ArrowRight across KaTeX pill does not trap caret or throw", () => {
      const editor = new StressEditorHarness([
        { id: "b1", type: "text", content: "Prefix $E=mc^2$ Suffix" },
      ]);
      const el = editor.getDOM("b1");
      setCaretAtOffset(el, 8); // At start of pill

      for (let i = 0; i < 500; i++) {
        const key = i % 2 === 0 ? "ArrowRight" : "ArrowLeft";
        const event = new MockEvent("keydown", { key });
        editor.handleKeyDown(event, "b1");
      }

      assert.equal(editor.blocks.length, 1);
      assert.equal(editor.blocks[0].content, "Prefix $E=mc^2$ Suffix");
    });
  });

  describe("Suite 6: Multi-Formula Line Splitting & Matrix Merging Stress", () => {

    it("ST-601: Line splitting between multiple KaTeX formulas ($a$ + $b$ = $c$) splits cleanly into respective blocks", () => {
      const editor = new StressEditorHarness([
        { id: "b1", type: "text", content: "$a$ + $b$ = $c$" },
      ]);
      const el = editor.getDOM("b1");

      // Set caret right after "+ " (offset 6)
      setCaretAtOffset(el, 6);
      const event = new MockEvent("keydown", { key: "Enter" });
      editor.handleKeyDown(event, "b1");

      assert.equal(editor.blocks.length, 2);
      assert.equal(editor.blocks[0].content, "$a$ + ");
      assert.equal(editor.blocks[1].content, "$b$ = $c$");
    });

    it("ST-602: Backspace merging into previous block ending with complex matrix formula", () => {
      const matrixFormula = "$\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}$";
      const editor = new StressEditorHarness([
        { id: "b1", type: "h2", content: `Matrix ${matrixFormula}` },
        { id: "b2", type: "text", content: " is invertible" },
      ]);

      const el2 = editor.getDOM("b2");
      setCaretToStart(el2);

      const event = new MockEvent("keydown", { key: "Backspace" });
      editor.handleKeyDown(event, "b2");

      assert.equal(editor.blocks.length, 1);
      assert.equal(editor.blocks[0].content, `Matrix ${matrixFormula} is invertible`);
      assert.equal(editor.blocks[0].type, "h2");
    });

    it("ST-603: Bottom whitespace click when last block is non-text (table, code, math) creates new text paragraph", () => {
      const nonTextTypes = ["table", "code", "math", "divider"];
      for (const type of nonTextTypes) {
        const editor = new StressEditorHarness([
          { id: "b1", type, content: type === "code" ? "console.log(1);" : "" },
        ]);
        editor.handleBottomWhitespaceClick();

        assert.equal(editor.blocks.length, 2, `Whitespace click after ${type} must append text block`);
        assert.equal(editor.blocks[1].type, "text");
        assert.equal(editor.blocks[1].content, "");
        assert.equal(editor.selectedId, editor.blocks[1].id);
      }
    });
  });

});
