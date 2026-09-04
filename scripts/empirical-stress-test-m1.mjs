/**
 * Empirical Challenger Verification Suite for SocraticOS Milestone 1
 * Stress-testing:
 *   1. Live Inline Math Auto-Compilation ($formula$)
 *   2. Keystroke Swallowing & Adjacent Typing
 *   3. Boundary Traversal & Stepping (ArrowLeft / ArrowRight)
 *   4. Pill Removal (Backspace / Delete)
 *   5. Caret Start/End Inversion & Offset Positioning
 *   6. Popover Editing, Keystroke Isolation & KaTeX Error Resilience
 *   7. Lossless Roundtrip Serialization with Complex Formulas
 */

import katex from "katex";
import {
  cleanZeroWidth,
  renderKatexToStringMemoized,
  escapeHtml,
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

// ─── 1. SIMULATED DOM ENVIRONMENT ──────────────────────────────────────────

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
  }

  get isContentEditable() {
    return this.attributes["contenteditable"] === "true";
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
      }
    }
    return false;
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

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
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
        html += `<${tag}${attrs}>${child.innerHTML}</${tag}>`;
      }
    }
    return html;
  }

  set innerHTML(htmlStr) {
    this.childNodes = [];
    parseHTMLToMock(htmlStr, this);
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
}

function parseHTMLToMock(htmlStr, rootEl) {
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
        const attrRegex = /([a-zA-Z0-9_\-:]+)(?:=(?:"([^"]*)"|'([^']*)'|([^>\s]+)))?/g;
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
        const isSelfClosing = /^(br|hr|img|input)$/i.test(tagName) || token.endsWith("/>");
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

  cloneContents() {
    const frag = new MockElement("div");
    if (!this.startContainer || !this.endContainer) return frag;

    // Helper: find common ancestor
    function getAncestors(node) {
      const list = [];
      let curr = node;
      while (curr) {
        list.unshift(curr);
        curr = curr.parentNode;
      }
      return list;
    }

    const startAnc = getAncestors(this.startContainer);
    const endAnc = getAncestors(this.endContainer);
    let commonAncestor = null;
    for (let i = 0; i < Math.min(startAnc.length, endAnc.length); i++) {
      if (startAnc[i] === endAnc[i]) {
        commonAncestor = startAnc[i];
      } else {
        break;
      }
    }

    if (!commonAncestor) return frag;

    let insideRange = false;
    let finished = false;

    const startC = this.startContainer;
    const startO = this.startOffset;
    const endC = this.endContainer;
    const endO = this.endOffset;

    function walkClone(node) {
      if (finished) return null;

      if (node === startC) {
        insideRange = true;
        if (node.nodeType === 3) {
          const endCut = (node === endC) ? endO : node.length;
          if (node === endC) finished = true;
          const text = node.nodeValue.slice(startO, endCut);
          return new MockTextNode(text);
        }
      }

      if (node === endC) {
        if (node.nodeType === 3) {
          finished = true;
          const startCut = (node === startC) ? startO : 0;
          const text = node.nodeValue.slice(startCut, endO);
          return new MockTextNode(text);
        }
      }

      if (node.nodeType === 3) {
        if (insideRange && !finished) {
          return new MockTextNode(node.nodeValue);
        }
        return null;
      }

      if (node.nodeType === 1) {
        const clonedEl = new MockElement(node.tagName);
        for (const [k, v] of Object.entries(node.attributes)) {
          clonedEl.setAttribute(k, v);
        }

        let hasChildren = false;
        const startIndex = (node === startC && startC.nodeType === 1) ? startO : 0;
        const endIndex = (node === endC && endC.nodeType === 1) ? endO : node.childNodes.length;

        for (let i = 0; i < node.childNodes.length; i++) {
          const child = node.childNodes[i];
          if (node === startC && i < startIndex) continue;
          if (node === endC && i >= endIndex) {
            finished = true;
            break;
          }
          if (child === startC || child.contains(startC)) {
            insideRange = true;
          }
          const clonedChild = walkClone(child);
          if (clonedChild) {
            clonedEl.appendChild(clonedChild);
            hasChildren = true;
          }
          if (child === endC || child.contains(endC)) {
            finished = true;
            break;
          }
        }

        if (node === commonAncestor) {
          for (const c of [...clonedEl.childNodes]) {
            frag.appendChild(c);
          }
          return frag;
        }

        return hasChildren || insideRange ? clonedEl : null;
      }
      return null;
    }

    walkClone(commonAncestor);
    return frag;
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

  getRangeAt(index) {
    return this.ranges[index] || null;
  }

  addRange(range) {
    this.ranges = [range];
  }

  removeAllRanges() {
    this.ranges = [];
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

// Attach mock DOM globals
const mockDoc = {
  createElement: (tagName) => new MockElement(tagName),
  createTextNode: (text) => new MockTextNode(text),
  createRange: () => new MockRange(),
  createTreeWalker: (root, whatToShow, filter) => new MockTreeWalker(root, whatToShow, filter),
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

// ─── 2. TEST HARNESS & ASSERTIONS ──────────────────────────────────────────

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function testCase(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✔ PASS: ${name}`);
  } catch (err) {
    failedTests++;
    failures.push({ name, error: err.message, stack: err.stack });
    console.error(`  ✖ FAIL: ${name} -> ${err.message}`);
  }
}

function assertEquals(actual, expected, msg = "") {
  if (actual !== expected) {
    throw new Error(`Assertion failed: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}. ${msg}`);
  }
}

function assertTrue(cond, msg = "") {
  if (!cond) {
    throw new Error(`Assertion failed: expected true. ${msg}`);
  }
}

function assertFalse(cond, msg = "") {
  if (cond) {
    throw new Error(`Assertion failed: expected false. ${msg}`);
  }
}

// ─── 3. SUITE EXECUTION ───────────────────────────────────────────────────

console.log("\n═════════════════════════════════════════════════════════════════");
console.log("  EMPIRICAL CHALLENGER VERIFICATION — MILESTONE 1 (M1)");
console.log("═════════════════════════════════════════════════════════════════\n");

// ─── DIMENSION 1: Live Inline Math Auto-Compilation ($formula$) ─────────
console.log("▶ Dimension 1: Live Inline Math Auto-Compilation ($formula$)");

testCase("1.1 Single character formula $x$ compiles on closing $", () => {
  const root = new MockElement("div");
  root.setAttribute("contenteditable", "true");
  const textNode = new MockTextNode("Here is $x$");
  root.appendChild(textNode);

  const range = new MockRange();
  range.setStart(textNode, 11);
  range.setEnd(textNode, 11);
  mockSelection.removeAllRanges();
  mockSelection.addRange(range);

  const result = tryAutoFormatInlineMath(root);
  assertTrue(result, "tryAutoFormatInlineMath returned true");

  const pill = root.querySelector(".katex-inline-node");
  assertTrue(Boolean(pill), "Pill span exists");
  assertEquals(pill.getAttribute("data-formula"), "x", "Pill has data-formula='x'");
  assertEquals(pill.getAttribute("contenteditable"), "false", "Pill is contenteditable=false");
  
  // Verify trailing text node created with space
  const trailing = pill.nextSibling;
  assertTrue(Boolean(trailing && trailing.nodeType === 3), "Trailing text node exists");
  assertEquals(trailing.nodeValue, " ", "Trailing text node contains space");

  // Verify caret placed at offset 1 of trailing text node
  const activeRange = mockSelection.getRangeAt(0);
  assertEquals(activeRange.startContainer, trailing, "Caret container is trailing node");
  assertEquals(activeRange.startOffset, 1, "Caret offset is 1");
});

testCase("1.2 Complex formula with spaces and LaTeX macros auto-compiles", () => {
  const root = new MockElement("div");
  root.setAttribute("contenteditable", "true");
  const textNode = new MockTextNode("Energy equation $\\Delta E = mc^2$");
  root.appendChild(textNode);

  const range = new MockRange();
  range.setStart(textNode, textNode.length);
  range.setEnd(textNode, textNode.length);
  mockSelection.removeAllRanges();
  mockSelection.addRange(range);

  const result = tryAutoFormatInlineMath(root);
  assertTrue(result, "Formula with macros and spaces auto-compiles");

  const pill = root.querySelector(".katex-inline-node");
  assertEquals(pill.getAttribute("data-formula"), "\\Delta E = mc^2");
  assertTrue(pill.innerHTML.includes("katex"), "KaTeX HTML rendered inside pill");
});

testCase("1.3 Formula with comparisons ($0 < x < 10$) preserves characters", () => {
  const root = new MockElement("div");
  root.setAttribute("contenteditable", "true");
  const textNode = new MockTextNode("Range: $0 < x < 10$");
  root.appendChild(textNode);

  const range = new MockRange();
  range.setStart(textNode, textNode.length);
  range.setEnd(textNode, textNode.length);
  mockSelection.removeAllRanges();
  mockSelection.addRange(range);

  const result = tryAutoFormatInlineMath(root);
  assertTrue(result);
  const pill = root.querySelector(".katex-inline-node");
  assertEquals(pill.getAttribute("data-formula"), "0 < x < 10");
});

testCase("1.4 Rejects empty delimiters $$", () => {
  const root = new MockElement("div");
  root.setAttribute("contenteditable", "true");
  const textNode = new MockTextNode("Empty $$");
  root.appendChild(textNode);

  const range = new MockRange();
  range.setStart(textNode, textNode.length);
  range.setEnd(textNode, textNode.length);
  mockSelection.removeAllRanges();
  mockSelection.addRange(range);

  const result = tryAutoFormatInlineMath(root);
  assertFalse(result, "Empty $$ must not auto-compile as inline math");
});

testCase("1.5 Rejects whitespace-only formula $   $", () => {
  const root = new MockElement("div");
  root.setAttribute("contenteditable", "true");
  const textNode = new MockTextNode("Spaces $   $");
  root.appendChild(textNode);

  const range = new MockRange();
  range.setStart(textNode, textNode.length);
  range.setEnd(textNode, textNode.length);
  mockSelection.removeAllRanges();
  mockSelection.addRange(range);

  const result = tryAutoFormatInlineMath(root);
  assertFalse(result, "Whitespace-only $   $ must not auto-compile");
});

testCase("1.6 Rejects leading space inside delimiter $ x$", () => {
  const root = new MockElement("div");
  root.setAttribute("contenteditable", "true");
  const textNode = new MockTextNode("Price is $ 100$");
  root.appendChild(textNode);

  const range = new MockRange();
  range.setStart(textNode, textNode.length);
  range.setEnd(textNode, textNode.length);
  mockSelection.removeAllRanges();
  mockSelection.addRange(range);

  const result = tryAutoFormatInlineMath(root);
  assertFalse(result, "Currency or leading-space $ 100$ must not auto-compile");
});

testCase("1.7 Prevents recursive compilation when typing inside math pill", () => {
  const root = new MockElement("div");
  root.setAttribute("contenteditable", "true");
  const pill = new MockElement("span");
  pill.className = "katex-inline-node";
  const insideText = new MockTextNode("inside $x$");
  pill.appendChild(insideText);
  root.appendChild(pill);

  const range = new MockRange();
  range.setStart(insideText, insideText.length);
  range.setEnd(insideText, insideText.length);
  mockSelection.removeAllRanges();
  mockSelection.addRange(range);

  const result = tryAutoFormatInlineMath(root);
  assertFalse(result, "Must not compile inside an existing math pill");
});

testCase("1.8 Gracefully handles invalid LaTeX syntax without crashing", () => {
  const html = renderKatexToStringMemoized("\\frac{invalid", { throwOnError: false });
  assertTrue(typeof html === "string" && html.length > 0, "Returns fallback string without throwing");
});

// ─── DIMENSION 2: Keystroke Isolation & Adjacent Typing ──────────────────
console.log("\n▶ Dimension 2: Keystroke Isolation & Adjacent Typing");

testCase("2.1 Typing characters immediately after auto-compilation does not swallow chars", () => {
  const root = new MockElement("div");
  root.setAttribute("contenteditable", "true");
  const textNode = new MockTextNode("Start $x$");
  root.appendChild(textNode);

  const range = new MockRange();
  range.setStart(textNode, textNode.length);
  range.setEnd(textNode, textNode.length);
  mockSelection.removeAllRanges();
  mockSelection.addRange(range);

  tryAutoFormatInlineMath(root);

  // Simulate user typing "+ y = z" in the active selection
  const selRange = mockSelection.getRangeAt(0);
  const targetNode = selRange.startContainer;
  const insertOffset = selRange.startOffset;

  const typed = "+ y = z";
  targetNode.nodeValue =
    targetNode.nodeValue.slice(0, insertOffset) + typed + targetNode.nodeValue.slice(insertOffset);

  const serialized = getBlockTextFromDOM(root);
  assertEquals(serialized, "Start $x$ + y = z", "Serialized text contains full formula and adjacent typing");
});

testCase("2.2 cleanZeroWidth removes zero-width tokens without eating valid spaces", () => {
  const dirty = "Hello\u200B \uFEFFWorld\u200C\u200D!";
  const cleaned = cleanZeroWidth(dirty);
  assertEquals(cleaned, "Hello World!", "Zero width tokens removed, space preserved");
});

// ─── DIMENSION 3: Boundary Traversal & Stepping ─────────────────────────
console.log("\n▶ Dimension 3: Boundary Traversal & Stepping (ArrowLeft / ArrowRight)");

testCase("3.1 ArrowLeft after math pill steps across to preceding text node", () => {
  const root = new MockElement("div");
  root.setAttribute("contenteditable", "true");
  const beforeText = new MockTextNode("Alpha ");
  const pill = new MockElement("span");
  pill.className = "katex-inline-node";
  pill.setAttribute("data-formula", "x");
  const afterText = new MockTextNode(" Beta");
  root.appendChild(beforeText);
  root.appendChild(pill);
  root.appendChild(afterText);

  // Caret at offset 0 of afterText (immediately after pill)
  const range = new MockRange();
  range.setStart(afterText, 0);
  range.setEnd(afterText, 0);
  mockSelection.removeAllRanges();
  mockSelection.addRange(range);

  const event = new MockEvent("keydown", { key: "ArrowLeft" });
  const handled = handleInlineBoundaryKeyDown(event);
  assertTrue(handled, "ArrowLeft was handled");
  assertTrue(event.defaultPrevented, "Default prevented");

  const newRange = mockSelection.getRangeAt(0);
  assertEquals(newRange.startContainer, beforeText, "Caret moved to beforeText");
  assertEquals(newRange.startOffset, beforeText.length, "Caret is at end of beforeText");
});

testCase("3.2 ArrowRight before math pill steps across to following text node", () => {
  const root = new MockElement("div");
  root.setAttribute("contenteditable", "true");
  const beforeText = new MockTextNode("Alpha ");
  const pill = new MockElement("span");
  pill.className = "katex-inline-node";
  pill.setAttribute("data-formula", "x");
  const afterText = new MockTextNode(" Beta");
  root.appendChild(beforeText);
  root.appendChild(pill);
  root.appendChild(afterText);

  // Caret at offset length of beforeText (immediately before pill)
  const range = new MockRange();
  range.setStart(beforeText, beforeText.length);
  range.setEnd(beforeText, beforeText.length);
  mockSelection.removeAllRanges();
  mockSelection.addRange(range);

  const event = new MockEvent("keydown", { key: "ArrowRight" });
  const handled = handleInlineBoundaryKeyDown(event);
  assertTrue(handled, "ArrowRight was handled");
  assertTrue(event.defaultPrevented, "Default prevented");

  const newRange = mockSelection.getRangeAt(0);
  assertEquals(newRange.startContainer, afterText, "Caret moved to afterText");
  assertEquals(newRange.startOffset, 0, "Caret is at start of afterText");
});

testCase("3.3 Child-indexed ArrowLeft and ArrowRight step over math pill cleanly", () => {
  const root = new MockElement("div");
  root.setAttribute("contenteditable", "true");
  const beforeText = new MockTextNode("A");
  const pill = new MockElement("span");
  pill.className = "katex-inline-node";
  const afterText = new MockTextNode("B");
  root.appendChild(beforeText);
  root.appendChild(pill);
  root.appendChild(afterText);

  // Child index 1 (pill index)
  const range = new MockRange();
  range.setStart(root, 1);
  range.setEnd(root, 1);
  mockSelection.removeAllRanges();
  mockSelection.addRange(range);

  const event = new MockEvent("keydown", { key: "ArrowRight" });
  const handled = handleInlineBoundaryKeyDown(event);
  assertTrue(handled, "Child-indexed ArrowRight handled");

  const newRange = mockSelection.getRangeAt(0);
  assertEquals(newRange.startContainer, afterText, "Stepped to afterText");
  assertEquals(newRange.startOffset, 0);
});

// ─── DIMENSION 4: Pill Removal (Backspace / Delete) ─────────────────────
console.log("\n▶ Dimension 4: Pill Removal (Backspace / Delete)");

testCase("4.1 Backspace at offset 0 after math pill removes pill atomically", () => {
  const root = new MockElement("div");
  root.setAttribute("contenteditable", "true");
  let inputDispatched = false;
  root.addEventListener("input", () => { inputDispatched = true; });

  const beforeText = new MockTextNode("Let ");
  const pill = new MockElement("span");
  pill.className = "katex-inline-node";
  pill.setAttribute("data-formula", "f(x)");
  const afterText = new MockTextNode(" be continuous.");
  root.appendChild(beforeText);
  root.appendChild(pill);
  root.appendChild(afterText);

  // Caret at offset 0 of afterText
  const range = new MockRange();
  range.setStart(afterText, 0);
  range.setEnd(afterText, 0);
  mockSelection.removeAllRanges();
  mockSelection.addRange(range);

  const event = new MockEvent("keydown", { key: "Backspace" });
  const handled = handleInlineBoundaryKeyDown(event);
  assertTrue(handled, "Backspace was handled");
  assertTrue(event.defaultPrevented, "Default prevented");

  // Pill must be removed
  assertFalse(root.contains(pill), "Pill removed from DOM");
  assertTrue(inputDispatched, "Input event dispatched on editable container");

  const newRange = mockSelection.getRangeAt(0);
  assertEquals(newRange.startContainer, beforeText, "Caret in beforeText");
  assertEquals(newRange.startOffset, beforeText.length, "Caret at end of beforeText");
});

testCase("4.2 Delete at end offset before math pill removes pill atomically", () => {
  const root = new MockElement("div");
  root.setAttribute("contenteditable", "true");
  let inputDispatched = false;
  root.addEventListener("input", () => { inputDispatched = true; });

  const beforeText = new MockTextNode("Let ");
  const pill = new MockElement("span");
  pill.className = "katex-inline-node";
  pill.setAttribute("data-formula", "f(x)");
  const afterText = new MockTextNode(" be continuous.");
  root.appendChild(beforeText);
  root.appendChild(pill);
  root.appendChild(afterText);

  // Caret at end of beforeText
  const range = new MockRange();
  range.setStart(beforeText, beforeText.length);
  range.setEnd(beforeText, beforeText.length);
  mockSelection.removeAllRanges();
  mockSelection.addRange(range);

  const event = new MockEvent("keydown", { key: "Delete" });
  const handled = handleInlineBoundaryKeyDown(event);
  assertTrue(handled, "Delete was handled");
  assertTrue(event.defaultPrevented, "Default prevented");

  assertFalse(root.contains(pill), "Pill removed from DOM");
  assertTrue(inputDispatched, "Input event dispatched on editable container");
});

// ─── DIMENSION 5: Caret Start/End Inversion & Offset Positioning ────────
console.log("\n▶ Dimension 5: Caret Start/End Inversion & Offset Positioning");

testCase("5.1 setCaretToStart on block starting with math pill puts caret BEFORE pill", () => {
  const root = new MockElement("div");
  root.setAttribute("contenteditable", "true");
  setBlockDOMFromText(root, "$E = mc^2$ is the energy equation.");

  setCaretToStart(root);

  const range = mockSelection.getRangeAt(0);
  const firstChild = root.firstChild;
  assertTrue(firstChild.nodeType === 3, "First child is a text node");
  assertEquals(range.startContainer, firstChild, "Caret startContainer is leading text node");
  assertEquals(range.startOffset, 0, "Caret offset is 0 before pill");
});

testCase("5.2 setCaretToEnd on block ending with math pill puts caret AFTER pill", () => {
  const root = new MockElement("div");
  root.setAttribute("contenteditable", "true");
  setBlockDOMFromText(root, "The value is $x^2$.");

  setCaretToEnd(root);

  const range = mockSelection.getRangeAt(0);
  const lastChild = root.lastChild;
  assertTrue(lastChild.nodeType === 3, "Last child is a text node");
  assertEquals(range.startContainer, lastChild, "Caret startContainer is trailing text node");
  assertEquals(range.startOffset, lastChild.length, "Caret is at end of trailing text node");
});

testCase("5.3 getDOMCaretLength counts KaTeX pills as $formula$ length", () => {
  const root = new MockElement("div");
  setBlockDOMFromText(root, "Given $x = 10$ and $y = 20$.");

  const len = getDOMCaretLength(root);
  const expectedLen = "Given $x = 10$ and $y = 20$.".length;
  assertEquals(len, expectedLen, "DOM caret length matches markdown string length");
});

testCase("5.4 setCaretAtOffset navigates precisely across multiple math pills", () => {
  const root = new MockElement("div");
  root.setAttribute("contenteditable", "true");
  setBlockDOMFromText(root, "A $x$ B $y$ C");

  // Offset 0 -> before 'A'
  setCaretAtOffset(root, 0);
  assertEquals(mockSelection.getRangeAt(0).startOffset, 0);

  // Offset 5 -> after '$x$'
  setCaretAtOffset(root, 5);
  const r5 = mockSelection.getRangeAt(0);
  assertTrue(r5.startContainer.nodeType === 3, "Anchored in text node");

  // Offset at end
  setCaretAtOffset(root, 13);
  const rEnd = mockSelection.getRangeAt(0);
  assertTrue(rEnd.startContainer.nodeType === 3, "Anchored in trailing text node");
});

// ─── DIMENSION 6: Block Boundary Navigation & Visual Lines ─────────────
console.log("\n▶ Dimension 6: Block Boundary Navigation & Visual Lines");

testCase("6.1 isCaretAtLogicalStart is true when before leading math pill", () => {
  const root = new MockElement("div");
  root.setAttribute("contenteditable", "true");
  setBlockDOMFromText(root, "$f(x)$ is a function.");

  setCaretToStart(root);
  assertTrue(isCaretAtLogicalStart(root), "isCaretAtLogicalStart is true");
  assertTrue(isCaretAtBlockStart(root), "isCaretAtBlockStart is true");
});

testCase("6.2 isCaretAtLogicalEnd is true when after trailing math pill", () => {
  const root = new MockElement("div");
  root.setAttribute("contenteditable", "true");
  setBlockDOMFromText(root, "Result is $42$.");

  setCaretToEnd(root);
  assertTrue(isCaretAtLogicalEnd(root), "isCaretAtLogicalEnd is true");
  assertTrue(isCaretAtBlockEnd(root), "isCaretAtBlockEnd is true");
});

testCase("6.3 splitBlockDOMAtRange splits cleanly without losing math formula", () => {
  const root = new MockElement("div");
  root.setAttribute("contenteditable", "true");
  setBlockDOMFromText(root, "First part $a+b=c$ second part");

  // Position caret in the middle of "second part"
  const trailingNode = root.lastChild;
  const range = new MockRange();
  range.setStart(trailingNode, 8); // after " second "
  range.setEnd(trailingNode, 8);

  const { textBefore, textAfter } = splitBlockDOMAtRange(root, range);
  assertTrue(textBefore.includes("$a+b=c$"), "textBefore retains math formula");
  assertTrue(textAfter.includes("part"), "textAfter retains subsequent text");
});

// ─── DIMENSION 7: Lossless Roundtrip Serialization ──────────────────────
console.log("\n▶ Dimension 7: Lossless Roundtrip Serialization with Complex Formulas");

const testFormulas = [
  "f(x) = x^2 + 2x + 1",
  "\\frac{a+b}{c-d}",
  "\\sqrt[3]{x^3+y^3}",
  "\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}",
  "\\sum_{k=1}^{n} k = \\frac{n(n+1)}{2}",
  "\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1",
  "\\begin{matrix} a & b \\\\ c & d \\end{matrix}",
  "\\alpha + \\beta \\le \\gamma \\neq \\theta",
  "E = mc^2",
  "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}",
  "e^{i\\pi} + 1 = 0",
  "\\nabla \\times \\vec{B} = \\mu_0 \\vec{J} + \\mu_0 \\epsilon_0 \\frac{\\partial \\vec{E}}{\\partial t}",
];

for (let i = 0; i < testFormulas.length; i++) {
  const formula = testFormulas[i];
  testCase(`7.${i + 1} Round-trip formula: $${formula}$`, () => {
    const originalText = `Prefix text with $${formula}$ in middle and end $x$.`;
    const root = new MockElement("div");
    setBlockDOMFromText(root, originalText);

    const serialized = getBlockTextFromDOM(root);
    assertEquals(serialized, originalText, `Serialized matches original verbatim`);
  });
}

// ─── SUMMARY & VERDICT ────────────────────────────────────────────────────

console.log("\n═════════════════════════════════════════════════════════════════");
console.log(`TOTAL TESTS:  ${totalTests}`);
console.log(`PASSED:       ${passedTests}`);
console.log(`FAILED:       ${failedTests}`);
console.log("═════════════════════════════════════════════════════════════════\n");

if (failedTests > 0) {
  console.error("FAILURES ENCOUNTERED:");
  for (const f of failures) {
    console.error(`- ${f.name}: ${f.error}`);
  }
  process.exit(1);
} else {
  console.log("ALL EMPIRICAL CHALLENGE TESTS PASSED PERFECTLY!\n");
  process.exit(0);
}
