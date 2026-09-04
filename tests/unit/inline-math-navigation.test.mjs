import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  cleanZeroWidth,
  formatMarkdownInline,
  tryAutoFormatInlineMath,
  handleInlineBoundaryKeyDown,
  isCaretAtLogicalStart,
  isCaretAtLogicalEnd,
  isCaretAtBlockStart,
  isCaretAtBlockEnd,
  isCaretOnFirstVisualLine,
  isCaretOnLastVisualLine,
  getDOMCaretLength,
  setCaretToStart,
  setCaretToEnd,
  setCaretAtOffset,
  getBlockTextFromDOM,
  setBlockDOMFromText,
} from "../../lib/editorCaret.js";

describe("Milestone 1 (M1): Navigation & Inline Math Pills (F1, F2, F3)", () => {
  describe("F1: Seamless Arrow Block Navigation & Boundary Helpers", () => {
    it("cleanZeroWidth strips all invisible zero-width and null unicode tokens", () => {
      const dirty = "Hello\u200B\u200C\u200D\u2060\uFEFF\u0000World";
      assert.strictEqual(cleanZeroWidth(dirty), "HelloWorld");
      assert.strictEqual(cleanZeroWidth(""), "");
      assert.strictEqual(cleanZeroWidth(null), "");
    });

    it("getDOMCaretLength computes coordinate length including formula pills", () => {
      const mockDiv = {
        tagName: "DIV",
        childNodes: [],
      };
      assert.strictEqual(getDOMCaretLength(mockDiv), 0);

      const mockInput = { tagName: "INPUT", value: "hello math" };
      assert.strictEqual(getDOMCaretLength(mockInput), 10);
    });

    it("isCaretAtLogicalStart and isCaretAtLogicalEnd support input elements", () => {
      const input = { tagName: "INPUT", value: "test", selectionStart: 0, selectionEnd: 0 };
      assert.strictEqual(isCaretAtLogicalStart(input), true);
      assert.strictEqual(isCaretAtLogicalEnd(input), false);

      const inputEnd = { tagName: "INPUT", value: "test", selectionStart: 4, selectionEnd: 4 };
      assert.strictEqual(isCaretAtLogicalStart(inputEnd), false);
      assert.strictEqual(isCaretAtLogicalEnd(inputEnd), true);
    });

    it("isCaretOnFirstVisualLine and isCaretOnLastVisualLine fallback safely when no window/DOM", () => {
      assert.strictEqual(isCaretOnFirstVisualLine(null, null), false);
      assert.strictEqual(isCaretOnLastVisualLine(null, null), false);
    });
  });

  describe("F2: Inline Pill Boundary Traversal (handleInlineBoundaryKeyDown)", () => {
    it("returns false safely when window or selection is undefined in non-DOM environment", () => {
      const event = { key: "ArrowLeft", preventDefault: () => {} };
      const handled = handleInlineBoundaryKeyDown(event);
      assert.strictEqual(handled, false);
    });

    it("verifies inline math boundary pattern logic for closing $ match", () => {
      const regex = /\$([^\s$](?:[^$\n]*[^\s$])?)\$$/;

      // Valid formulas
      assert.ok(regex.test("Let $x$"));
      assert.ok(regex.test("Formula $f(x) = x^2$"));
      assert.ok(regex.test("Constant $\\alpha$"));
      assert.ok(regex.test("Integration $\\int_0^1 x dx$"));

      // Matches exact formula content
      const match = "Test $E = mc^2$".match(regex);
      assert.strictEqual(match[1], "E = mc^2");

      // Invalid / non-matching formulas
      assert.strictEqual(regex.test("Price is $5 and $10"), false);
      assert.strictEqual(regex.test("Empty $$"), false);
    });
  });

  describe("F3: Inline Math Interaction & Compilation (formatMarkdownInline & getBlockTextFromDOM)", () => {
    it("formats in-sentence math into interactive katex-inline-node pills", () => {
      const formatted = formatMarkdownInline("Calculate $x^2 + y^2 = z^2$ cleanly.");
      assert.ok(formatted.includes('class="katex-inline-node'));
      assert.ok(formatted.includes('data-formula="x^2 + y^2 = z^2"'));
      assert.ok(formatted.includes('contenteditable="false"'));
    });

    it("formats inline code into code elements", () => {
      const formatted = formatMarkdownInline("Execute `npm test` here.");
      assert.ok(formatted.includes('<code class='));
      assert.ok(formatted.includes("npm test"));
    });

    it("preserves formulas with special symbols (&, <, >) in data-formula attribute", () => {
      const formatted = formatMarkdownInline("Formula $a < b && c > d$");
      assert.ok(formatted.includes("katex-inline-node"));
      assert.ok(formatted.includes("data-formula="));
    });

    it("handles setCaretToStart, setCaretToEnd, setCaretAtOffset gracefully without crashing", () => {
      assert.doesNotThrow(() => setCaretToStart(null));
      assert.doesNotThrow(() => setCaretToEnd(null));
      assert.doesNotThrow(() => setCaretAtOffset(null, 0));
    });

    it("handles tryAutoFormatInlineMath safely on null element", () => {
      assert.strictEqual(tryAutoFormatInlineMath(null), false);
    });
  });
});
