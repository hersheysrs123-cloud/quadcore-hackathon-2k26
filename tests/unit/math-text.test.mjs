import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseMathSegments } from "../../lib/mathUtils.js";
import { renderKatexToStringMemoized } from "../../lib/editorCaret.js";

describe("MathText & LaTeX Quiz Rendering Subsystem", () => {
  it("returns plain text unchanged when no math patterns are present", () => {
    const segments = parseMathSegments("What is the primary function of mitochondria in eukaryotic cells?");
    assert.strictEqual(segments.length, 1);
    assert.strictEqual(segments[0].type, "text");
    assert.strictEqual(segments[0].content, "What is the primary function of mitochondria in eukaryotic cells?");
  });

  it("parses single dollar inline math ($formula$) embedded in question prose", () => {
    const text = "Calculate the energy $E$ when mass is $m = 2\\text{ kg}$ using $E = mc^2$.";
    const segments = parseMathSegments(text);

    assert.strictEqual(segments.length, 7);
    assert.strictEqual(segments[0].type, "text");
    assert.strictEqual(segments[0].content, "Calculate the energy ");
    assert.strictEqual(segments[1].type, "inline_math");
    assert.strictEqual(segments[1].content, "E");
    assert.strictEqual(segments[2].type, "text");
    assert.strictEqual(segments[2].content, " when mass is ");
    assert.strictEqual(segments[3].type, "inline_math");
    assert.strictEqual(segments[3].content, "m = 2\\text{ kg}");
    assert.strictEqual(segments[4].type, "text");
    assert.strictEqual(segments[4].content, " using ");
    assert.strictEqual(segments[5].type, "inline_math");
    assert.strictEqual(segments[5].content, "E = mc^2");
    assert.strictEqual(segments[6].type, "text");
    assert.strictEqual(segments[6].content, ".");
  });

  it("parses double dollar display math ($$...$$) and bracket notation (\\[...\\])", () => {
    const text = "Consider Newton's second law:\n$$\\vec{F} = m\\vec{a}$$\nand gravitational formula:\n\\[F = \\frac{G m_1 m_2}{r^2}\\]";
    const segments = parseMathSegments(text);

    assert.ok(segments.some((s) => s.type === "display_math" && s.content === "\\vec{F} = m\\vec{a}"));
    assert.ok(segments.some((s) => s.type === "display_math" && s.content === "F = \\frac{G m_1 m_2}{r^2}"));
  });

  it("parses parenthesis notation \\(...\\) for inline math", () => {
    const text = "Find the derivative \\(f'(x) = 3x^2\\) of the cubic polynomial.";
    const segments = parseMathSegments(text);

    assert.strictEqual(segments.length, 3);
    assert.strictEqual(segments[0].content, "Find the derivative ");
    assert.strictEqual(segments[1].type, "inline_math");
    assert.strictEqual(segments[1].content, "f'(x) = 3x^2");
    assert.strictEqual(segments[2].content, " of the cubic polynomial.");
  });

  it("detects bare LaTeX formulas in multiple choice options without requiring enclosing delimiters", () => {
    const optionA = "\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}";
    const segmentsA = parseMathSegments(optionA);

    assert.strictEqual(segmentsA.length, 1);
    assert.strictEqual(segmentsA[0].type, "inline_math");
    assert.strictEqual(segmentsA[0].content, "\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}");

    const optionChem = "\\text{H}_2\\text{SO}_4 + 2\\text{NaOH} \\rightarrow \\text{Na}_2\\text{SO}_4 + 2\\text{H}_2\\text{O}";
    const segmentsChem = parseMathSegments(optionChem);

    assert.strictEqual(segmentsChem.length, 1);
    assert.strictEqual(segmentsChem[0].type, "inline_math");
    assert.strictEqual(segmentsChem[0].content, optionChem);
  });

  it("renders LaTeX formulas into KaTeX HTML strings successfully via memoized renderer", () => {
    const formula = "E = mc^2";
    const html = renderKatexToStringMemoized(formula, { displayMode: false });

    assert.ok(html.includes("katex"));
    assert.ok(html.includes("mathnormal"));
    assert.ok(html.includes("E"));

    // Chemistry reaction rendering
    const chemHtml = renderKatexToStringMemoized("\\text{H}_2\\text{O}", { displayMode: false });
    assert.ok(chemHtml.includes("katex"));

    // Malformed syntax fallback without throwing exception
    const brokenHtml = renderKatexToStringMemoized("\\frac{broken", { displayMode: false });
    assert.ok(brokenHtml); // Produces safe fallback without crashing
  });
});
