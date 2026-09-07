import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseMathSegments, sanitizeMathText } from "../../lib/mathUtils.js";
import { renderKatexToStringMemoized, KATEX_GLOBAL_MACROS } from "../../lib/editorCaret.js";
import { repairJsonLatexEscapes } from "../../lib/gemini.js";

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

  it("extracts bare \\frac inside prose without delimiters into inline math", () => {
    const text = "The formula for acceleration is \\frac{\\Delta v}{\\Delta t}, where \\Delta v is velocity change.";
    const segments = parseMathSegments(text);

    assert.strictEqual(segments[0].type, "text");
    assert.strictEqual(segments[0].content, "The formula for acceleration is ");
    assert.strictEqual(segments[1].type, "inline_math");
    assert.strictEqual(segments[1].content, "\\frac{\\Delta v}{\\Delta t}");
    assert.strictEqual(segments[2].type, "text");
    assert.strictEqual(segments[2].content, ", where ");
    assert.strictEqual(segments[3].type, "inline_math");
    assert.strictEqual(segments[3].content, "\\Delta v");
    assert.strictEqual(segments[4].type, "text");
    assert.strictEqual(segments[4].content, " is velocity change.");

    // Render the extracted math segment to verify it renders without error
    const fracHtml = renderKatexToStringMemoized(segments[1].content);
    assert.ok(fracHtml.includes("frac-line"));
    assert.ok(!fracHtml.includes("ParseError"));
  });

  it("heals and renders \\ext as \\text without KaTeX error", () => {
    const text = "The unit is \\ext{m/s}^2 for acceleration.";
    const segments = parseMathSegments(text);

    // Verify \\ext was normalized
    assert.ok(segments.some((s) => s.type === "inline_math" && s.content.includes("\\text{m/s}^2")));

    // Verify KaTeX global macro renders \\ext{hello} cleanly
    assert.strictEqual(KATEX_GLOBAL_MACROS["\\ext"], "\\text{#1}");
    const extHtml = renderKatexToStringMemoized("\\ext{meters}", { displayMode: false });
    assert.ok(extHtml.includes("meters"));
    assert.ok(!extHtml.includes("color:#cc0000")); // No red KaTeX error
  });

  it("heals JSON-escaped control character corruptions (form-feed \\frac and tab \\text)", () => {
    // Single-backslash JSON parsing turns \f into \u000c and \t into \u0009
    const corruptedInput = "Formula is \u000crac{dy}{dx} and unit is \u0009ext{kg}.";
    const sanitized = sanitizeMathText(corruptedInput);
    assert.strictEqual(sanitized, "Formula is \\frac{dy}{dx} and unit is \\text{kg}.");

    const segments = parseMathSegments(corruptedInput);
    assert.ok(segments.some((s) => s.type === "inline_math" && s.content === "\\frac{dy}{dx}"));
    assert.ok(segments.some((s) => s.type === "inline_math" && s.content === "\\text{kg}"));
  });

  it("repairs raw wire JSON with single-backslash LaTeX keywords before JSON.parse", () => {
    const rawWire = '{"tldr": "Formula is \\frac{a}{b} and \\text{test}."}';
    const repaired = repairJsonLatexEscapes(rawWire);
    const parsed = JSON.parse(repaired);

    // Characters should be literal backslash + 'f' and backslash + 't', NOT \u000c or \u0009
    assert.ok(parsed.tldr.includes("\\frac{a}{b}"));
    assert.ok(parsed.tldr.includes("\\text{test}"));
    assert.ok(!parsed.tldr.includes("\u000c"));
    assert.ok(!parsed.tldr.includes("\u0009"));
  });

  it("handles mixed delimited math and bare LaTeX in the same prose string", () => {
    const text = "Given $v_0 = 0$, we have \\frac{\\Delta x}{\\Delta t} = \\bar{v}.";
    const segments = parseMathSegments(text);

    assert.ok(segments.some((s) => s.type === "inline_math" && s.content === "v_0 = 0"));
    assert.ok(segments.some((s) => s.type === "inline_math" && s.content === "\\frac{\\Delta x}{\\Delta t}"));
  });
});
