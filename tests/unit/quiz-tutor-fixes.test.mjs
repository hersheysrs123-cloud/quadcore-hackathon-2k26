import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { effectiveAnswer, gradeObjectively, isAnswerGiven } from "../../lib/aiService.js";
import { normalizeHistory } from "../../lib/gemini.js";

const stepQ = { type: "step_ordering", steps: ["a", "b", "c"], options: ["b", "a", "c"] };
const codeQ = { type: "code_input", starterCode: "def f(x):\n    pass" };

describe("effectiveAnswer", () => {
  it("answers an untouched step ordering with the order shown", () => {
    assert.deepEqual(effectiveAnswer(stepQ, undefined), ["b", "a", "c"]);
    assert.deepEqual(effectiveAnswer(stepQ, []), ["b", "a", "c"]);
    assert.deepEqual(effectiveAnswer({ type: "step_ordering", steps: ["x", "y"] }, undefined), ["x", "y"]);
  });

  it("keeps a reordered answer", () => {
    assert.deepEqual(effectiveAnswer(stepQ, ["a", "b", "c"]), ["a", "b", "c"]);
  });

  it("answers untouched code with the starter code, but not cleared code", () => {
    assert.equal(effectiveAnswer(codeQ, undefined), codeQ.starterCode);
    assert.equal(effectiveAnswer(codeQ, ""), "");
    assert.equal(effectiveAnswer(codeQ, "print(1)"), "print(1)");
  });

  it("leaves other question types alone", () => {
    assert.equal(effectiveAnswer({ type: "short_answer" }, undefined), undefined);
    assert.equal(effectiveAnswer({ type: "multiple_choice" }, 2), 2);
  });

  it("grades an untouched order that happens to be right as correct, not skipped", () => {
    const q = { type: "step_ordering", steps: ["a", "b", "c"], options: ["a", "b", "c"] };
    const [g] = gradeObjectively([q], [{ answer: effectiveAnswer(q, undefined) }]);
    assert.equal(g.answered, true);
    assert.equal(g.objective, true);
  });
});

describe("isAnswerGiven", () => {
  it("counts an untouched step ordering and untouched starter code", () => {
    assert.equal(isAnswerGiven(stepQ, undefined), true);
    assert.equal(isAnswerGiven(codeQ, undefined), true);
  });

  it("does not count empty answers", () => {
    assert.equal(isAnswerGiven({ type: "short_answer" }, "   "), false);
    assert.equal(isAnswerGiven({ type: "multi_select" }, []), false);
    assert.equal(isAnswerGiven({ type: "code_input" }, undefined), false);
    assert.equal(isAnswerGiven(codeQ, ""), false);
  });

  it("counts a picked option 0", () => {
    assert.equal(isAnswerGiven({ type: "multiple_choice" }, 0), true);
  });
});

describe("tutor history sent to Gemini", () => {
  it("drops the panel's greeting so the conversation opens on the learner", () => {
    const history = normalizeHistory([
      { role: "assistant", content: "Hello! I'm your AI Tutor" },
      { role: "user", content: "What is a derivative?" },
    ]);
    assert.deepEqual(history.map((m) => m.role), ["user"]);
  });

  it("drops empty and unknown turns", () => {
    const history = normalizeHistory([
      { role: "user", content: "  " },
      { role: "system", content: "x" },
      { role: "user", content: "hi" },
    ]);
    assert.deepEqual(history, [{ role: "user", content: "hi" }]);
  });
});
