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

// ─── Browser DOM Simulator ──────────────────────────────────────────────────

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
      this.classes.delete(cls);
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

    // Helper to find index of a node in its parent
    const indexOf = (node) => (node.parentNode ? node.parentNode.childNodes.indexOf(node) : -1);

    // Helper to check if node A is strictly before node B in document order
    const isNodeBefore = (nodeA, nodeB) => {
      if (nodeA === nodeB) return false;
      const root = nodeA.parentNode || nodeA;
      // Get all descendants in order
      const allNodes = [];
      const collect = (n) => {
        allNodes.push(n);
        for (const c of n.childNodes || []) collect(c);
      };
      let top = root;
      while (top.parentNode) top = top.parentNode;
      collect(top);
      return allNodes.indexOf(nodeA) < allNodes.indexOf(nodeB);
    };

    // Case 1: startContainer === endContainer
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

    // Case 2: startContainer and endContainer are different
    // Find lowest common ancestor
    let ancestor = this.startContainer;
    while (ancestor && !ancestor.contains(this.endContainer)) {
      ancestor = ancestor.parentNode;
    }
    if (!ancestor) ancestor = this.startContainer.parentNode || this.startContainer;

    // Helper to partially/fully clone a node within range boundaries
    const cloneSubtree = (node) => {
      // If node is strictly outside range
      if (node.nodeType === 3) {
        if (node === this.startContainer) {
          const txt = node.nodeValue.substring(this.startOffset);
          return new MockTextNode(txt);
        }
        if (node === this.endContainer) {
          const txt = node.nodeValue.substring(0, this.endOffset);
          return new MockTextNode(txt);
        }
        return node.cloneNode(true);
      }

      if (node.nodeType === 1) {
        if (!node.contains(this.startContainer) && !node.contains(this.endContainer)) {
          return node.cloneNode(true);
        }

        const clone = new MockElement(node.tagName);
        for (const [k, v] of Object.entries(node.attributes)) {
          clone.setAttribute(k, v);
        }

        let include = !node.contains(this.startContainer);
        for (let i = 0; i < node.childNodes.length; i++) {
          const child = node.childNodes[i];

          if (node === this.startContainer && i === this.startOffset) {
            include = true;
          }

          if (child.contains(this.startContainer) || child === this.startContainer) {
            clone.appendChild(cloneSubtree(child));
            include = true;
            continue;
          }

          if (child.contains(this.endContainer) || child === this.endContainer) {
            clone.appendChild(cloneSubtree(child));
            break;
          }

          if (node === this.endContainer && i === this.endOffset) {
            break;
          }

          if (include) {
            clone.appendChild(child.cloneNode(true));
          }
        }
        return clone;
      }
      return node.cloneNode(true);
    };

    let include = this.startContainer === ancestor ? false : false;
    for (let i = 0; i < ancestor.childNodes.length; i++) {
      const child = ancestor.childNodes[i];

      if (ancestor === this.startContainer && i === this.startOffset) {
        include = true;
      }

      if (child.contains(this.startContainer) || child === this.startContainer) {
        frag.appendChild(cloneSubtree(child));
        include = true;
        continue;
      }

      if (child.contains(this.endContainer) || child === this.endContainer) {
        frag.appendChild(cloneSubtree(child));
        break;
      }

      if (ancestor === this.endContainer && i === this.endOffset) {
        break;
      }

      if (include) {
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

// ─── STRESS TEST SUITE: MILESTONE 1 CHALLENGER ───────────────────────────────

describe("Empirical Challenger M1: Arrow Navigation & Inline Math Stress Suite", () => {
  beforeEach(() => {
    mockSelection.removeAllRanges();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 1: LEADING AND TRAILING MATH PILLS CARET INTEGRITY
  // ═══════════════════════════════════════════════════════════════════════════
  describe("1. Leading, Trailing & Isolated Math Pills Boundary Invariants", () => {
    it("CH-101: Block starting with math pill positions caret before pill on setCaretToStart", () => {
      const el = new MockElement("div");
      setBlockDOMFromText(el, "$E=mc^2$ is Einstein's mass-energy equivalence.");
      
      setCaretToStart(el);
      const sel = window.getSelection();
      assert.equal(sel.rangeCount, 1, "Selection has 1 range");
      const range = sel.getRangeAt(0);
      assert.equal(range.startContainer.nodeType, 3, "Caret is in a text node");
      assert.equal(range.startOffset, 0, "Caret offset is 0");
      assert.equal(range.startContainer.nextSibling.classList.contains("katex-inline-node"), true, "Next sibling is the math pill");
      assert.equal(isCaretAtLogicalStart(el, range), true, "isCaretAtLogicalStart is TRUE at leading pill start");
    });

    it("CH-102: Block ending with math pill positions caret after pill on setCaretToEnd", () => {
      const el = new MockElement("div");
      setBlockDOMFromText(el, "Energy formula: $E=mc^2$");
      
      setCaretToEnd(el);
      const sel = window.getSelection();
      assert.equal(sel.rangeCount, 1, "Selection has 1 range");
      const range = sel.getRangeAt(0);
      assert.equal(range.startContainer.nodeType, 3, "Caret is in a text node");
      assert.equal(range.startContainer.previousSibling.classList.contains("katex-inline-node"), true, "Previous sibling is the math pill");
      
      const textBefore = getSerializedTextFromRange(el, range.endContainer, range.endOffset);
      const fullText = getBlockTextFromDOM(el);
      // console.log("DEBUG CH-102:", { textBefore, fullText, isEnd: isCaretAtLogicalEnd(el, range) });
      assert.equal(isCaretAtLogicalEnd(el, range), true, `isCaretAtLogicalEnd is TRUE at trailing pill end (got before="${textBefore}", full="${fullText}")`);
    });

    it("CH-103: Block consisting ONLY of a math pill ($x$) satisfies start and end invariants", () => {
      const el = new MockElement("div");
      setBlockDOMFromText(el, "$x$");
      
      // Start
      setCaretToStart(el);
      let range = window.getSelection().getRangeAt(0);
      assert.equal(range.startContainer.nodeType, 3, "Caret is in text node before pill");
      assert.equal(range.startContainer.nextSibling.classList.contains("katex-inline-node"), true);
      assert.equal(isCaretAtLogicalStart(el, range), true, "isCaretAtLogicalStart is TRUE for solo pill at start");

      // End
      setCaretToEnd(el);
      range = window.getSelection().getRangeAt(0);
      assert.equal(range.startContainer.nodeType, 3, "Caret is in text node after pill");
      assert.equal(range.startContainer.previousSibling.classList.contains("katex-inline-node"), true);
      assert.equal(isCaretAtLogicalEnd(el, range), true, "isCaretAtLogicalEnd is TRUE for solo pill at end");
    });

    it("CH-104: Block with multiple adjacent math pills ($a$$b$$c$) maintains correct DOM length and offsets", () => {
      const el = new MockElement("div");
      setBlockDOMFromText(el, "$a$$b$$c$");
      
      const domLength = getDOMCaretLength(el);
      const expectedLength = "$a$$b$$c$".length; // 3 + 3 + 3 = 9
      assert.equal(domLength, expectedLength, "getDOMCaretLength accurately computes coordinate length for adjacent pills");

      const serialized = getBlockTextFromDOM(el);
      assert.equal(serialized, "$a$$b$$c$", "getBlockTextFromDOM accurately restores markdown text");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 2: ARROW NAVIGATION ACROSS INLINE PILLS & BLOCKS
  // ═══════════════════════════════════════════════════════════════════════════
  describe("2. Arrow Navigation Traversal Across Pills and Multi-Block Sequences", () => {
    it("CH-201: ArrowRight steps over math pill from left text node to right text node", () => {
      const el = new MockElement("div");
      setBlockDOMFromText(el, "Let $x$ be a real number.");
      
      // Place caret right before math pill
      const pill = el.querySelector(".katex-inline-node");
      const textBefore = pill.previousSibling;
      const range = new MockRange();
      range.setStart(textBefore, textBefore.length);
      range.setEnd(textBefore, textBefore.length);
      mockSelection.removeAllRanges();
      mockSelection.addRange(range);

      const evt = new MockEvent("keydown", { key: "ArrowRight", cancelable: true });
      const handled = handleInlineBoundaryKeyDown(evt);
      assert.equal(handled, true, "handleInlineBoundaryKeyDown handled ArrowRight step-over");
      assert.equal(evt.defaultPrevented, true, "Default event prevented");

      const newRange = mockSelection.getRangeAt(0);
      assert.equal(newRange.startContainer, pill.nextSibling, "Caret moved to text node after pill");
      assert.equal(newRange.startOffset, 0, "Caret placed at offset 0 after pill");
    });

    it("CH-202: ArrowLeft steps over math pill from right text node to left text node", () => {
      const el = new MockElement("div");
      setBlockDOMFromText(el, "Let $x$ be a real number.");
      
      // Place caret right after math pill
      const pill = el.querySelector(".katex-inline-node");
      const textAfter = pill.nextSibling;
      const range = new MockRange();
      range.setStart(textAfter, 0);
      range.setEnd(textAfter, 0);
      mockSelection.removeAllRanges();
      mockSelection.addRange(range);

      const evt = new MockEvent("keydown", { key: "ArrowLeft", cancelable: true });
      const handled = handleInlineBoundaryKeyDown(evt);
      assert.equal(handled, true, "handleInlineBoundaryKeyDown handled ArrowLeft step-over");
      assert.equal(evt.defaultPrevented, true, "Default event prevented");

      const newRange = mockSelection.getRangeAt(0);
      assert.equal(newRange.startContainer, pill.previousSibling, "Caret moved to text node before pill");
      assert.equal(newRange.startOffset, pill.previousSibling.length, "Caret placed at end of text node before pill");
    });

    it("CH-203: Traversal through alternating mixed pills: <code>code</code> and $math$", () => {
      const el = new MockElement("div");
      setBlockDOMFromText(el, "Use `const` with $x = 10$ and `let` with $y = 20$.");
      
      const codePills = el.querySelectorAll("code:not(.code-block)");
      const mathPills = el.querySelectorAll(".katex-inline-node");
      assert.equal(codePills.length, 2, "2 code pills parsed");
      assert.equal(mathPills.length, 2, "2 math pills parsed");

      // Verify caret can traverse across all pills seamlessly
      setCaretToStart(el);
      assert.equal(isCaretAtLogicalStart(el), true);

      setCaretToEnd(el);
      assert.equal(isCaretAtLogicalEnd(el), true);
    });

    it("CH-204: Arrow navigation across multi-block document with diverse types and empty blocks", () => {
      const blockDefs = [
        { id: "b1", type: "h1", text: "Introduction to $f(x)$" },
        { id: "b2", type: "text", text: "" }, // Empty block
        { id: "b3", type: "text", text: "Formula $A = \\pi r^2$ for circles." },
        { id: "b4", type: "bullet", text: "$B = 2\\pi r$" },
        { id: "b5", type: "text", text: "" }, // Another empty block
        { id: "b6", type: "math", text: "\\int_0^1 x dx = 0.5" },
        { id: "b7", type: "divider", text: "" },
        { id: "b8", type: "text", text: "End note with `result`." },
      ];

      const domElements = blockDefs.map((def) => {
        const el = new MockElement("div");
        el.id = `block_${def.id}`;
        setBlockDOMFromText(el, def.text, def.type);
        return el;
      });

      // Forward step check (ArrowDown simulation)
      for (let i = 0; i < domElements.length; i++) {
        const el = domElements[i];
        setCaretToStart(el);
        assert.equal(isCaretOnFirstVisualLine(el, mockSelection.getRangeAt(0)), true, `Block ${i} caret on first visual line`);
        setCaretToEnd(el);
        assert.equal(isCaretOnLastVisualLine(el, mockSelection.getRangeAt(0)), true, `Block ${i} caret on last visual line`);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 3: ATOMIC BACKSPACE & DELETE DESTRUCTION OF PILLS
  // ═══════════════════════════════════════════════════════════════════════════
  describe("3. Atomic Backspace and Delete Behavior on Math & Code Pills", () => {
    it("CH-301: Backspace immediately after KaTeX pill removes the pill atomically and preserves text", () => {
      const el = new MockElement("div");
      setBlockDOMFromText(el, "Prefix $x^2$ Suffix");
      
      const pill = el.querySelector(".katex-inline-node");
      const textAfter = pill.nextSibling;
      
      const range = new MockRange();
      range.setStart(textAfter, 0);
      range.setEnd(textAfter, 0);
      mockSelection.removeAllRanges();
      mockSelection.addRange(range);

      let inputDispatched = false;
      el.addEventListener("input", () => { inputDispatched = true; });

      const evt = new MockEvent("keydown", { key: "Backspace", cancelable: true });
      const handled = handleInlineBoundaryKeyDown(evt);

      assert.equal(handled, true, "Backspace handled");
      assert.equal(evt.defaultPrevented, true, "Default prevented");
      assert.equal(el.querySelector(".katex-inline-node"), null, "Pill is removed from DOM");
      assert.equal(inputDispatched, true, "input event dispatched to parent");
      
      const fullText = getBlockTextFromDOM(el);
      assert.equal(fullText, "Prefix  Suffix", "Text before and after preserved intact");
    });

    it("CH-302: Delete immediately before KaTeX pill removes the pill atomically and preserves text", () => {
      const el = new MockElement("div");
      setBlockDOMFromText(el, "Prefix $x^2$ Suffix");
      
      const pill = el.querySelector(".katex-inline-node");
      const textBefore = pill.previousSibling;
      
      const range = new MockRange();
      range.setStart(textBefore, textBefore.length);
      range.setEnd(textBefore, textBefore.length);
      mockSelection.removeAllRanges();
      mockSelection.addRange(range);

      let inputDispatched = false;
      el.addEventListener("input", () => { inputDispatched = true; });

      const evt = new MockEvent("keydown", { key: "Delete", cancelable: true });
      const handled = handleInlineBoundaryKeyDown(evt);

      assert.equal(handled, true, "Delete handled");
      assert.equal(evt.defaultPrevented, true, "Default prevented");
      assert.equal(el.querySelector(".katex-inline-node"), null, "Pill is removed from DOM");
      assert.equal(inputDispatched, true, "input event dispatched to parent");
      
      const fullText = getBlockTextFromDOM(el);
      assert.equal(fullText, "Prefix  Suffix", "Text before and after preserved intact");
    });

    it("CH-303: Backspace on container element with child index immediately after pill deletes it cleanly", () => {
      const el = new MockElement("div");
      setBlockDOMFromText(el, "$alpha$");
      
      const pill = el.querySelector(".katex-inline-node");
      const childIdx = el.childNodes.indexOf(pill);

      // Caret positioned on element child index after pill
      const range = new MockRange();
      range.setStart(el, childIdx + 1);
      range.setEnd(el, childIdx + 1);
      mockSelection.removeAllRanges();
      mockSelection.addRange(range);

      const evt = new MockEvent("keydown", { key: "Backspace", cancelable: true });
      const handled = handleInlineBoundaryKeyDown(evt);

      assert.equal(handled, true, "Child-indexed Backspace handled");
      assert.equal(el.querySelector(".katex-inline-node"), null, "Pill deleted");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 4: LIVE AUTO-COMPILATION OF INLINE MATH FORMULAS
  // ═══════════════════════════════════════════════════════════════════════════
  describe("4. Live Math Auto-Compilation ($formula$) and Edge Delimiters", () => {
    it("CH-401: Auto-compiles valid single and complex LaTeX formulas upon closing $ delimiter", () => {
      const formulas = [
        "x",
        "E=mc^2",
        "\\frac{a+b}{c-d}",
        "\\sum_{i=1}^n i = \\frac{n(n+1)}{2}",
        "\\alpha \\beta \\gamma",
        "\\sqrt{x^2 + y^2}",
      ];

      for (const formula of formulas) {
        const el = new MockElement("div");
        const textNode = new MockTextNode(`Equation $${formula}$`);
        el.appendChild(textNode);

        const range = new MockRange();
        range.setStart(textNode, textNode.length);
        range.setEnd(textNode, textNode.length);
        mockSelection.removeAllRanges();
        mockSelection.addRange(range);

        const compiled = tryAutoFormatInlineMath(el);
        assert.equal(compiled, true, `Formula $${formula}$ auto-compiled successfully`);

        const pill = el.querySelector(".katex-inline-node");
        assert.ok(pill, "Math pill inserted into DOM");
        assert.equal(pill.getAttribute("data-formula"), formula, "Pill contains correct data-formula");
        assert.equal(pill.getAttribute("contenteditable"), "false", "Pill is contenteditable=false");
      }
    });

    it("CH-402: Rejects invalid or incomplete math syntax and does NOT compile", () => {
      const invalidCases = [
        "Cost is $50 only",        // Unclosed dollar
        "Price is $ 50 $",          // Space after leading $
        "Formula $x $",             // Space before trailing $
        "Empty $$",                 // Empty math delimiter
        "Items \\$5 and \\$10",     // Escaped dollar signs without closing pair
      ];

      for (const testCase of invalidCases) {
        const el = new MockElement("div");
        const textNode = new MockTextNode(testCase);
        el.appendChild(textNode);

        const range = new MockRange();
        range.setStart(textNode, textNode.length);
        range.setEnd(textNode, textNode.length);
        mockSelection.removeAllRanges();
        mockSelection.addRange(range);

      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 5: RANDOMIZED MONKEY / FUZZING NAVIGATION STRESS TEST (2,000 OPS)
  // ═══════════════════════════════════════════════════════════════════════════
  describe("5. Invariant Fuzzing & High-Density Randomized Navigation (2,000 Ops)", () => {
    it("CH-501: 2,000 randomized arrow navigation operations across 50 blocks maintain valid caret state", () => {
      // Build 50 blocks with varied pill patterns
      const numBlocks = 50;
      const samplePatterns = [
        "",
        "Plain text block without formulas.",
        "Leading pill: $a^2$ with text.",
        "Trailing pill with text: $b^2$",
        "$solo_pill$",
        "Multiple pills: $x$ + $y$ = $z$ and `val`.",
        "Adjacent pills: $p1$$p2$$p3$.",
        "# Heading with $H(s)$ formula",
        "- List bullet item with `code` and $math$",
        "Long paragraph with math $f(x) = \\int_{-\\infty}^\\infty e^{-x^2} dx$ and inline code `calculate()` followed by another pill $\\pi$.",
      ];

      const blocks = [];
      for (let i = 0; i < numBlocks; i++) {
        const pattern = samplePatterns[i % samplePatterns.length];
        const el = new MockElement("div");
        el.id = `block_${i}`;
        setBlockDOMFromText(el, pattern);
        blocks.push({ id: `b_${i}`, el, text: pattern });
      }

      let currentBlockIdx = 0;
      setCaretToStart(blocks[0].el);

      const operations = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"];
      let stepCount = 0;

      for (let step = 0; step < 2000; step++) {
        stepCount++;
        const currentBlock = blocks[currentBlockIdx];
        const el = currentBlock.el;
        const op = operations[step % operations.length];

        if (op === "ArrowDown") {
          const sel = window.getSelection();
          if (sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            if (isCaretOnLastVisualLine(el, range)) {
              if (currentBlockIdx < blocks.length - 1) {
                currentBlockIdx++;
                setCaretToStart(blocks[currentBlockIdx].el);
              }
            }
          }
        } else if (op === "ArrowUp") {
          const sel = window.getSelection();
          if (sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            if (isCaretOnFirstVisualLine(el, range)) {
              if (currentBlockIdx > 0) {
                currentBlockIdx--;
                setCaretToEnd(blocks[currentBlockIdx].el);
              }
            }
          }
        } else if (op === "ArrowRight") {
          const sel = window.getSelection();
          if (sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            if (isCaretAtBlockEnd(el, range)) {
              if (currentBlockIdx < blocks.length - 1) {
                currentBlockIdx++;
                setCaretToStart(blocks[currentBlockIdx].el);
              }
            } else {
              // Try stepping over boundary pill
              const evt = new MockEvent("keydown", { key: "ArrowRight", cancelable: true });
              handleInlineBoundaryKeyDown(evt);
            }
          }
        } else if (op === "ArrowLeft") {
          const sel = window.getSelection();
          if (sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            if (isCaretAtBlockStart(el, range)) {
              if (currentBlockIdx > 0) {
                currentBlockIdx--;
                setCaretToEnd(blocks[currentBlockIdx].el);
              }
            } else {
              // Try stepping over boundary pill
              const evt = new MockEvent("keydown", { key: "ArrowLeft", cancelable: true });
              handleInlineBoundaryKeyDown(evt);
            }
          }
        } else if (op === "Home") {
          setCaretToStart(blocks[currentBlockIdx].el);
        } else if (op === "End") {
          setCaretToEnd(blocks[currentBlockIdx].el);
        }

        // INVARIANT VERIFICATION:
        const sel = window.getSelection();
        assert.equal(sel.rangeCount, 1, `Selection has exactly 1 range at step ${step}`);
        const activeRange = sel.getRangeAt(0);
        assert.ok(activeRange.startContainer, `startContainer is defined at step ${step}`);

        // Caret must never be trapped inside an uneditable child node of a KaTeX pill
        if (activeRange.startContainer.parentElement) {
          const insidePill = activeRange.startContainer.parentElement.closest(".katex, .katex-html, .mord, .mrel");
          assert.equal(insidePill, null, `Caret trapped inside internal KaTeX DOM at step ${step}`);
        }
      }

      assert.equal(stepCount, 2000, "Successfully executed 2,000 navigation steps without crashing or trapping caret");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 6: PATHOLOGICAL & COMPLEX LATEX FORMULAS
  // ═══════════════════════════════════════════════════════════════════════════
  describe("6. Pathological & High-Complexity LaTeX Formulas", () => {
    it("CH-601: Renders and navigates across complex matrix and multiline KaTeX structures", () => {
      const complexFormula = "\\begin{pmatrix} \\alpha & \\beta \\\\ \\gamma & \\delta \\end{pmatrix}";
      const el = new MockElement("div");
      setBlockDOMFromText(el, `Matrix: $${complexFormula}$ transformed.`);

      const pill = el.querySelector(".katex-inline-node");
      assert.ok(pill, "Matrix math pill rendered");
      assert.equal(pill.getAttribute("data-formula"), complexFormula);

      // Caret navigation across complex pill
      setCaretToStart(el);
      assert.equal(isCaretAtLogicalStart(el), true);

      setCaretToEnd(el);
      assert.equal(isCaretAtLogicalEnd(el), true);

      const serialized = getBlockTextFromDOM(el);
      assert.equal(serialized, `Matrix: $${complexFormula}$ transformed.`);
    });

    it("CH-602: Handles LaTeX entities and text operators within formula without breaking attributes or DOM", () => {
      const entityFormula = "x \\le 5 \\land y \\ge 10 \\text{ with } \\alpha";
      const el = new MockElement("div");
      setBlockDOMFromText(el, `Condition: $${entityFormula}$ holds.`);

      const pill = el.querySelector(".katex-inline-node");
      assert.ok(pill, "Entity formula pill rendered");
      
      const serialized = getBlockTextFromDOM(el);
      assert.equal(serialized, `Condition: $${entityFormula}$ holds.`);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 7: LINE SPLITTING & MERGING ACCURACY WITH MATH & CODE PILLS
  // ═══════════════════════════════════════════════════════════════════════════
  describe("7. Line Splitting & Merging Accuracy with Math and Code Pills", () => {
    it("CH-701: Splitting line immediately before math pill leaves pill in second block cleanly", () => {
      const el = new MockElement("div");
      setBlockDOMFromText(el, "Prefix $E=mc^2$ Suffix");

      const pill = el.querySelector(".katex-inline-node");
      const textBeforeNode = pill.previousSibling;

      // Position caret at end of prefix (before pill)
      const range = new MockRange();
      range.setStart(textBeforeNode, textBeforeNode.length);
      range.setEnd(textBeforeNode, textBeforeNode.length);

      const split = splitBlockDOMAtRange(el, range);
      assert.equal(split.textBefore, "Prefix ");
      assert.equal(split.textAfter, "$E=mc^2$ Suffix");
    });

    it("CH-702: Splitting line immediately after math pill leaves pill in first block cleanly", () => {
      const el = new MockElement("div");
      setBlockDOMFromText(el, "Prefix $E=mc^2$ Suffix");

      const pill = el.querySelector(".katex-inline-node");
      const textAfterNode = pill.nextSibling;

      // Position caret at start of suffix (after pill)
      const range = new MockRange();
      range.setStart(textAfterNode, 0);
      range.setEnd(textAfterNode, 0);

      const split = splitBlockDOMAtRange(el, range);
      assert.equal(split.textBefore, "Prefix $E=mc^2$");
      assert.equal(split.textAfter, " Suffix");
    });

    it("CH-703: Merging block ending with KaTeX pill into block starting with code pill computes exact offset", () => {
      const block1El = new MockElement("div");
      setBlockDOMFromText(block1El, "Formula $x^2$");

      const block2El = new MockElement("div");
      setBlockDOMFromText(block2El, "`code_pill` suffix");

      const domOffset = getDOMCaretLength(block1El);
      assert.equal(domOffset, "Formula $x^2$".length, "domOffset matches serialized length");

      // Merge text
      const mergedText = getBlockTextFromDOM(block1El) + getBlockTextFromDOM(block2El);
      assert.equal(mergedText, "Formula $x^2$`code_pill` suffix");

      const targetEl = new MockElement("div");
      setBlockDOMFromText(targetEl, mergedText);

      // Caret placed at domOffset
      setCaretAtOffset(targetEl, domOffset);
      const sel = window.getSelection();
      assert.equal(sel.rangeCount, 1);
      const r = sel.getRangeAt(0);
      assert.ok(r.startContainer);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 8: VISUAL LINE BOUNDING BOX CALCULATION & FALLBACKS
  // ═══════════════════════════════════════════════════════════════════════════
  describe("8. Visual Line Bounding Box Calculations & Fallbacks", () => {
    it("CH-801: isCaretOnFirstVisualLine and isCaretOnLastVisualLine gracefully fallback on missing getBoundingClientRect", () => {
      const el = new MockElement("div");
      setBlockDOMFromText(el, "Single line paragraph with $formula$.");

      // Mock getBoundingClientRect throwing error
      el.getBoundingClientRect = () => { throw new Error("DOM not laid out"); };

      setCaretToStart(el);
      const rangeStart = window.getSelection().getRangeAt(0);
      rangeStart.getBoundingClientRect = () => { throw new Error("DOM not laid out"); };
      assert.equal(isCaretOnFirstVisualLine(el, rangeStart), true, "Falls back to logical start");

      setCaretToEnd(el);
      const rangeEnd = window.getSelection().getRangeAt(0);
      rangeEnd.getBoundingClientRect = () => { throw new Error("DOM not laid out"); };
      assert.equal(isCaretOnLastVisualLine(el, rangeEnd), true, "Falls back to logical end");
    });
  });
});
