// ─── Quiz grading, against the engine that actually grades ───────────
// This file used to open with three private copies of gradeObjectively,
// fallbackHeatmap and normalizeQuizResult, and assert against those. It
// passed whatever lib/aiService.js did — and lib/aiService.js had moved on:
// it grades three more question types (multi_select, step_ordering,
// value_input) that the copy here had never heard of.
//
// Now it imports the shipped engine, so those types are covered too.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  gradeObjectively,
  fallbackHeatmap,
  normalizeQuizResult,
  clampScore,
} from "../../lib/aiService.js";

describe("Deterministic Quiz Grading Engine", () => {
  const mockQuestions = [
    {
      id: "q0",
      subtopic: "Optics",
      type: "multiple_choice",
      prompt: "What happens to light entering a denser medium at an angle?",
      options: ["Speeds up and bends away", "Slows down and bends toward the normal", "Reflects completely", "No change"],
      correctIndex: 1,
    },
    {
      id: "q1",
      subtopic: "Optics",
      type: "multiple_choice",
      prompt: "What is the unit of refractive index?",
      options: ["m/s", "Degrees", "Dimensionless (no unit)", "Joules"],
      correctIndex: 2,
    },
    {
      id: "q2",
      subtopic: "Thermodynamics",
      type: "short_answer",
      prompt: "Explain why gas pressure increases when temperature rises at constant volume.",
      expectedAnswer: "Particles gain kinetic energy, moving faster and colliding more frequently and forcefully with walls.",
    },
  ];

  it("grades multiple-choice questions objectively via integer equality", () => {
    const responses = [
      { answer: 1 }, // Correct
      { answer: 0 }, // Wrong (picked option 0)
      { answer: "Because particles move faster and hit walls harder" }, // Short answer
    ];

    const graded = gradeObjectively(mockQuestions, responses);

    assert.strictEqual(graded[0].answered, true);
    assert.strictEqual(graded[0].objective, true);
    assert.strictEqual(graded[0].display, "Slows down and bends toward the normal");

    assert.strictEqual(graded[1].answered, true);
    assert.strictEqual(graded[1].objective, false);
    assert.strictEqual(graded[1].display, "m/s");

    assert.strictEqual(graded[2].answered, true);
    assert.strictEqual(graded[2].objective, null); // delegated to model
  });

  it("handles unanswered/skipped questions without throwing exceptions", () => {
    const responses = [
      { answer: null },
      { answer: -1 },
      { answer: "" },
    ];

    const graded = gradeObjectively(mockQuestions, responses);
    assert.strictEqual(graded[0].answered, false);
    assert.strictEqual(graded[0].objective, false);
    assert.strictEqual(graded[1].answered, false);
    assert.strictEqual(graded[2].answered, false);
  });

  it("normalizes final score and synthesizes fallback heatmap per subtopic", () => {
    const responses = [
      { answer: 1 }, // MC right
      { answer: 2 }, // MC right
      { answer: "They vibrate faster" }, // Short answer marked correct by model
    ];

    const graded = gradeObjectively(mockQuestions, responses);
    const mockModelPayload = {
      score: 100,
      gradedAnswers: [{ questionIndex: 2, correct: true, feedback: "Correct mechanism" }],
      heatmap: [], // Empty -> triggers fallback synthesis
    };

    const result = normalizeQuizResult(mockModelPayload, mockQuestions, graded);

    assert.strictEqual(result.score, 100);
    assert.strictEqual(result.correctCount, 3);
    assert.strictEqual(result.totalCount, 3);

    // Fallback heatmap should group by Optics and Thermodynamics
    assert.strictEqual(result.heatmap.length, 2);
    const opticsHeatmap = result.heatmap.find((h) => h.subtopic === "Optics");
    const thermoHeatmap = result.heatmap.find((h) => h.subtopic === "Thermodynamics");

    assert.strictEqual(opticsHeatmap.status, "green"); // 2/2 right
    assert.strictEqual(thermoHeatmap.status, "green"); // 1/1 right
  });

  it("flags subtopic as red when all questions in that subtopic are wrong", () => {
    const responses = [{ answer: 0 }, { answer: 0 }, { answer: "" }];
    const graded = gradeObjectively(mockQuestions, responses);
    const mockModelPayload = {
      score: 0,
      gradedAnswers: [{ questionIndex: 2, correct: false }],
      heatmap: [],
    };

    const result = normalizeQuizResult(mockModelPayload, mockQuestions, graded);
    assert.strictEqual(result.score, 0);
    const opticsHeatmap = result.heatmap.find((h) => h.subtopic === "Optics");
    assert.strictEqual(opticsHeatmap.status, "red");
  });

  it("marks a subtopic yellow when it is part right", () => {
    const graded = gradeObjectively(mockQuestions, [{ answer: 1 }, { answer: 0 }, { answer: "" }]);
    const result = normalizeQuizResult({ heatmap: [] }, mockQuestions, graded);
    assert.strictEqual(result.heatmap.find((h) => h.subtopic === "Optics").status, "yellow");
  });

  it("never marks skipped/empty MCQ questions as Option A (0) correct", () => {
    // Question with correctIndex 0
    const mcqWithCorrectZero = [
      {
        id: "q0",
        subtopic: "Biology",
        type: "multiple_choice",
        prompt: "What is the basic unit of life?",
        options: ["Cell", "Tissue", "Organ", "Organism"],
        correctIndex: 0, // Option 0 is correct
      },
    ];

    // Learner left answer blank
    const blankResponse = [{ answer: "" }];
    const graded = gradeObjectively(mcqWithCorrectZero, blankResponse);

    assert.strictEqual(graded[0].answered, false);
    assert.strictEqual(graded[0].objective, false); // Must NOT be marked true even though correctIndex is 0

    const normalized = normalizeQuizResult({}, mcqWithCorrectZero, graded);
    assert.strictEqual(normalized.score, 0);
    assert.strictEqual(normalized.correctCount, 0);
  });

  it("safely handles null or undefined raw model payloads without crashing", () => {
    const graded = gradeObjectively(mockQuestions, [{ answer: 1 }, { answer: 2 }, { answer: "test" }]);
    const result = normalizeQuizResult({}, mockQuestions, graded);

    assert.ok(result);
    assert.strictEqual(result.score, 67); // 2/3 correct
    assert.strictEqual(result.correctCount, 2);
    assert.strictEqual(result.totalCount, 3);
    assert.ok(Array.isArray(result.heatmap));
  });

  it("uses positional fallback when model omits questionIndex", () => {
    const graded = gradeObjectively(mockQuestions, [{ answer: 1 }, { answer: 2 }, { answer: "good explanation" }]);
    const mockModelPayload = {
      gradedAnswers: [
        { feedback: "Option B is correct" },
        { feedback: "Option C is correct" },
        { correct: true, feedback: "Excellent answer" },
      ],
    };

    const result = normalizeQuizResult(mockModelPayload, mockQuestions, graded);
    assert.strictEqual(result.score, 100);
    assert.strictEqual(result.gradedAnswers[2].correct, true);
    assert.strictEqual(result.gradedAnswers[2].feedback, "Excellent answer");
  });

  it("keeps a model heatmap when it has one, and repairs an unknown status", () => {
    const graded = gradeObjectively(mockQuestions, [{ answer: 1 }, { answer: 2 }, { answer: "yes" }]);
    const result = normalizeQuizResult(
      { heatmap: [{ subtopic: " Optics ", status: "chartreuse", feedback: " solid " }] },
      mockQuestions,
      graded,
    );
    assert.strictEqual(result.heatmap.length, 1);
    assert.strictEqual(result.heatmap[0].subtopic, "Optics", "subtopic is trimmed");
    assert.strictEqual(result.heatmap[0].status, "yellow", "an off-schema status falls back to yellow");
    assert.strictEqual(result.heatmap[0].feedback, "solid");
  });

  it("clamps a score to 0-100 and rounds it", () => {
    assert.strictEqual(clampScore(66.67), 67);
    assert.strictEqual(clampScore(-20), 0);
    assert.strictEqual(clampScore(140), 100);
    assert.strictEqual(clampScore("nonsense"), 0);
  });
});

// ─── The types the private copy could not see ────────────────────────
// gradeObjectively grades these itself; the model is not consulted. The
// old private copy fell through to its short-answer branch for all three,
// so it would have handed every one of them to the model as objective:null.

describe("Objective grading of the non-MCQ question types", () => {
  it("grades multi_select only on an exact set match", () => {
    const q = [{
      subtopic: "Bonding", type: "multi_select",
      prompt: "Which are giant covalent?",
      options: ["Diamond", "Graphite", "Iodine", "Silicon dioxide"],
      correctIndices: [0, 1, 3],
    }];

    assert.strictEqual(gradeObjectively(q, [{ answer: [0, 1, 3] }])[0].objective, true);
    assert.strictEqual(gradeObjectively(q, [{ answer: [3, 1, 0] }])[0].objective, true, "order does not matter");
    assert.strictEqual(gradeObjectively(q, [{ answer: [0, 1] }])[0].objective, false, "a partial set is not credit");
    assert.strictEqual(gradeObjectively(q, [{ answer: [0, 1, 2, 3] }])[0].objective, false, "an extra pick is not credit");

    const blank = gradeObjectively(q, [{ answer: [] }])[0];
    assert.strictEqual(blank.answered, false);
    assert.strictEqual(blank.objective, false);
    assert.strictEqual(blank.display, "");

    assert.strictEqual(gradeObjectively(q, [{ answer: [0, 1, 3] }])[0].display, "Diamond, Graphite, Silicon dioxide");
  });

  it("grades step_ordering on the exact sequence", () => {
    const steps = ["Dissolve", "Filter", "Evaporate", "Crystallise"];
    const q = [{ subtopic: "Separation", type: "step_ordering", prompt: "Order the steps", steps }];

    assert.strictEqual(gradeObjectively(q, [{ answer: steps }])[0].objective, true);
    assert.strictEqual(
      gradeObjectively(q, [{ answer: ["Filter", "Dissolve", "Evaporate", "Crystallise"] }])[0].objective,
      false,
      "a swapped pair is wrong",
    );
    assert.strictEqual(gradeObjectively(q, [{ answer: ["Dissolve"] }])[0].answered, false, "one step is not an ordering");
    assert.strictEqual(
      gradeObjectively(q, [{ answer: steps }])[0].display,
      "1. Dissolve ➔ 2. Filter ➔ 3. Evaporate ➔ 4. Crystallise",
    );
  });

  it("grades value_input numerically, inside the question's tolerance", () => {
    const q = [{ subtopic: "Moles", type: "value_input", prompt: "Mass of 0.5 mol of water?", expectedAnswer: "9.0", tolerance: 0.1 }];

    assert.strictEqual(gradeObjectively(q, [{ answer: "9.0" }])[0].objective, true);
    assert.strictEqual(gradeObjectively(q, [{ answer: "9.05" }])[0].objective, true, "inside tolerance");
    assert.strictEqual(
      gradeObjectively(q, [{ answer: "9.5" }])[0].objective,
      null,
      "outside tolerance goes to the model, not straight to wrong",
    );
    assert.strictEqual(gradeObjectively(q, [{ answer: "" }])[0].answered, false);

    // A default tolerance of 0.01 applies when the question does not set one.
    const loose = [{ subtopic: "Moles", type: "value_input", prompt: "?", expectedAnswer: "2.50" }];
    assert.strictEqual(gradeObjectively(loose, [{ answer: "2.505" }])[0].objective, true);
    assert.strictEqual(gradeObjectively(loose, [{ answer: "2.6" }])[0].objective, null);
  });

  it("does not let the model overturn an objectively-graded question", () => {
    const q = [{
      subtopic: "Bonding", type: "multi_select", prompt: "Which are giant covalent?",
      options: ["Diamond", "Iodine"], correctIndices: [0],
    }];
    const graded = gradeObjectively(q, [{ answer: [1] }]); // objectively wrong
    const result = normalizeQuizResult({ gradedAnswers: [{ questionIndex: 0, correct: true }] }, q, graded);
    assert.strictEqual(result.gradedAnswers[0].correct, false, "the objective verdict wins");
    assert.strictEqual(result.score, 0);
  });

  it("lets an objectively-correct value_input stand without the model agreeing", () => {
    const q = [{ subtopic: "Moles", type: "value_input", prompt: "?", expectedAnswer: "9.0", tolerance: 0.1 }];
    const graded = gradeObjectively(q, [{ answer: "9.0" }]);
    const result = normalizeQuizResult({ gradedAnswers: [{ questionIndex: 0, correct: false }] }, q, graded);
    assert.strictEqual(result.gradedAnswers[0].correct, true);
  });
});

describe("fallbackHeatmap", () => {
  it("buckets by subtopic and reports the count in the feedback", () => {
    const heat = fallbackHeatmap([
      { subtopic: "Optics", correct: true },
      { subtopic: "Optics", correct: false },
      { subtopic: "Waves", correct: true },
    ]);
    assert.deepStrictEqual(heat.map((h) => h.subtopic), ["Optics", "Waves"], "in first-seen order");
    assert.strictEqual(heat[0].status, "yellow");
    assert.strictEqual(heat[0].feedback, "1 of 2 correct on this subtopic.");
    assert.strictEqual(heat[1].status, "green");
  });

  it("returns nothing for an empty session rather than throwing", () => {
    assert.deepStrictEqual(fallbackHeatmap([]), []);
  });
});
