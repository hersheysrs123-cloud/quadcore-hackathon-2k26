import { describe, it } from "node:test";
import assert from "node:assert/strict";
import katex from "katex";
import {
  escapeHtml,
  formatMarkdownInline,
  katexTrust,
  renderKatexToStringMemoized,
} from "../../lib/editorCaret.js";
import { formatInlineMarkdownForHtml, tryParseMarkdownToBlocks } from "../../lib/exportImport.js";
import {
  QUIZ_TYPE_MAX,
  gradeObjectively,
  heuristicReformatBlocks,
  normalizeExplanation,
  quizCount,
  quizLevelDirective,
  splitLeadingNumber,
} from "../../lib/aiService.js";

describe("inline Markdown in the editor", () => {
  it("cannot break out of a link's href with a quote", () => {
    const html = formatMarkdownInline('[x](https://a.com/"onmouseover="alert`1`)');
    assert.doesNotMatch(html, /"onmouseover=/);
    assert.match(html, /href="https:\/\/a\.com\/&quot;onmouseover=&quot;/);
  });

  it("escapes quotes and apostrophes", () => {
    assert.equal(escapeHtml(`"a" & 'b' <c>`), "&quot;a&quot; &amp; &#039;b&#039; &lt;c&gt;");
  });

  it("keeps $' and $& inside code as typed", () => {
    // one `$` per line, or the two would pair up as inline math
    assert.match(formatMarkdownInline("pre `a$'b` post"), /<code[^>]*>a\$&#039;b<\/code> post$/);
    assert.match(formatMarkdownInline("pre `x$&y` post"), /<code[^>]*>x\$&amp;y<\/code> post$/);
  });

  it("escapes the formula stored in data-formula", () => {
    const html = formatMarkdownInline('$a<b$');
    assert.match(html, /data-formula="a&lt;b"/);
  });
});

describe("inline Markdown in HTML export", () => {
  it("keeps $& inside code as typed", () => {
    assert.equal(formatInlineMarkdownForHtml("`$&`"), "<code>$&amp;</code>");
  });

  it("keeps the $ delimiters of a math token", () => {
    assert.equal(formatInlineMarkdownForHtml("$x^2$"), '<span class="inline-math">$x^2$</span>');
  });
});

describe("KaTeX trust", () => {
  const render = (tex) => renderKatexToStringMemoized(tex, { displayMode: false });

  it("drops javascript: links", () => {
    assert.doesNotMatch(render(String.raw`\href{javascript:alert(1)}{x}`), /href="javascript:/);
  });

  it("drops \\htmlStyle and \\htmlData", () => {
    assert.doesNotMatch(render(String.raw`\htmlStyle{position:fixed}{x}`), /style="position:fixed/);
    assert.doesNotMatch(render(String.raw`\htmlData{foo=bar}{x}`), /data-foo=/);
  });

  it("still allows web links", () => {
    assert.match(render(String.raw`\href{https://example.com}{x}`), /href="https:\/\/example\.com"/);
  });

  it("still renders \\reflectbox through the reflect-flip class", () => {
    assert.match(render(String.raw`\reflectbox{R}`), /class="[^"]*reflect-flip/);
    assert.equal(katexTrust({ command: "\\htmlClass", class: "evil" }), false);
  });

  it("is what katex itself sees as untrusted by default", () => {
    // sanity check that the commands above are gated by trust at all
    const html = katex.renderToString(String.raw`\href{javascript:alert(1)}{x}`, { trust: false, throwOnError: false });
    assert.doesNotMatch(html, /href="javascript:/);
  });
});

describe("heading cleanup regexes", () => {
  const nasty = "* ".repeat(40) + "x";

  it("parse a pathological Markdown heading quickly", () => {
    const t = Date.now();
    const blocks = tryParseMarkdownToBlocks(`## ${nasty}\n`);
    assert.ok(Date.now() - t < 500, "heading parse took too long");
    assert.equal(blocks[0].type, "h2");
  });

  it("strip the same characters as before", () => {
    const [h] = tryParseMarkdownToBlocks("## ** Kinetics ** \n");
    assert.equal(h.content, "Kinetics");
  });

  it("do not hang the reformat heuristic", () => {
    const t = Date.now();
    heuristicReformatBlocks([{ id: "a", type: "h2", content: nasty }], "T");
    assert.ok(Date.now() - t < 500, "reformat took too long");
  });
});

describe("explanation misconceptions", () => {
  it("carry the schema's whyItsWrong into correction", () => {
    const out = normalizeExplanation({
      misconceptions: [{ claim: "Heavier things fall faster", whyItsWrong: "Air resistance aside, g is the same." }],
    });
    assert.equal(out.misconceptions[0].correction, "Air resistance aside, g is the same.");
  });
});

describe("value_input grading", () => {
  const grade = (expectedAnswer, answer, tolerance) =>
    gradeObjectively([{ type: "value_input", expectedAnswer, tolerance }], [{ answer }])[0].objective;

  it("does not pass a different fraction or expression on its leading digit", () => {
    assert.equal(grade("1/2", "1/9"), null);
    assert.equal(grade("2x + 5", "2"), null);
    assert.equal(grade("10^5", "10"), null);
  });

  it("still applies tolerance to plain numbers and to matching units", () => {
    assert.equal(grade("9.8", "9.81", 0.05), true);
    assert.equal(grade("9.8 m/s^2", "9.81m/s^2", 0.05), true);
    assert.equal(grade("9.8 m/s^2", "9.81 kg", 0.05), null);
  });

  it("splits a leading number from its remainder", () => {
    assert.deepEqual(splitLeadingNumber("-1.5e3 J"), { value: -1500, rest: "J" });
    assert.equal(splitLeadingNumber("x + 1"), null);
  });
});

describe("quiz generation prompt", () => {
  it("calibrates to the chosen level, not always IGCSE", () => {
    assert.doesNotMatch(quizLevelDirective("ib_hl"), /IGCSE/);
    assert.match(quizLevelDirective("ib_hl"), /IB Diploma/);
    assert.match(quizLevelDirective("igcse_grade_10"), /Cambridge IGCSE/);
    assert.match(quizLevelDirective(undefined), /GENERAL/);
  });

  it("clamps requested counts to the form's caps", () => {
    assert.equal(quizCount(100000, QUIZ_TYPE_MAX.mcq, 3), 60);
    assert.equal(quizCount(-4, QUIZ_TYPE_MAX.mcq, 3), 0);
    assert.equal(quizCount("abc", QUIZ_TYPE_MAX.mcq, 3), 3);
    assert.equal(quizCount(undefined, QUIZ_TYPE_MAX.longAnswer, 0), 0);
  });
});
