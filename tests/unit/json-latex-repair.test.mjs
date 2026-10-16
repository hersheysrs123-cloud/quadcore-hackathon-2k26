import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readJson, repairJsonLatexEscapes } from "../../lib/gemini.js";

const wrap = (text) => ({ candidates: [{ content: { parts: [{ text }] } }] });
// What Gemini sends (JSON text, single backslashes) → the string we want back.
const parse = (jsonText) => readJson(wrap(jsonText)).a;

describe("LaTeX left with single backslashes in Gemini's JSON", () => {
  it("no longer loses the whole reply on \\sqrt, \\pi or \\cdot", () => {
    assert.equal(parse(String.raw`{"a":"$\sqrt{2}$"}`), String.raw`$\sqrt{2}$`);
    assert.equal(parse(String.raw`{"a":"$\pi r^2 \cdot h$"}`), String.raw`$\pi r^2 \cdot h$`);
    assert.equal(parse(String.raw`{"a":"$\Delta x \lambda$"}`), String.raw`$\Delta x \lambda$`);
  });

  it("keeps commands that start with an escape letter as commands", () => {
    assert.equal(parse(String.raw`{"a":"$\tan x + \textbf{y} + \tilde{z}$"}`), String.raw`$\tan x + \textbf{y} + \tilde{z}$`);
    assert.equal(parse(String.raw`{"a":"$\forall x, \frac{1}{2}$"}`), String.raw`$\forall x, \frac{1}{2}$`);
    assert.equal(parse(String.raw`{"a":"$\beta \binom{n}{k} \bmatrix$"}`), String.raw`$\beta \binom{n}{k} \bmatrix$`);
    assert.equal(parse(String.raw`{"a":"$\rho \rangle \right)$"}`), String.raw`$\rho \rangle \right)$`);
    assert.equal(parse(String.raw`{"a":"$\nabla \neq \neg p \nu$"}`), String.raw`$\nabla \neq \neg p \nu$`);
    assert.equal(parse(String.raw`{"a":"$\underline{x} \uparrow$"}`), String.raw`$\underline{x} \uparrow$`);
  });

  it("leaves real line breaks, tabs and unicode escapes alone", () => {
    assert.equal(parse(String.raw`{"a":"line one\nThe end\tif x"}`), "line one\nThe end\tif x");
    assert.equal(parse(String.raw`{"a":"café \"q\" back\\slash"}`), 'café "q" back\\slash');
    assert.equal(parse(String.raw`{"a":"a\nto b"}`), "a\nto b");
  });

  it("leaves correctly escaped LaTeX alone", () => {
    assert.equal(parse(String.raw`{"a":"$\\frac{a}{b} \\tan x$"}`), String.raw`$\frac{a}{b} \tan x$`);
  });

  it("repairs a single backslash that follows an escaped one", () => {
    // \\ is a literal backslash, then \sqrt: the text shows \ followed by the command
    assert.equal(parse(String.raw`{"a":"\\\sqrt{x}"}`), String.raw`\\sqrt{x}`);
  });

  it("matches commands as whole words after \\t and \\n", () => {
    // tab + "op" is not \top; newline + "eat" is not \ne
    assert.equal(parse(String.raw`{"a":"x\topen\neat"}`), "x\topen\neat");
  });

  it("passes non-strings through", () => {
    assert.equal(repairJsonLatexEscapes(null), null);
  });
});
