import { describe, it } from "node:test";
import assert from "node:assert/strict";

export function gradeObjectively(questions, responses) {
  return questions.map((question, i) => {
    const response = responses[i];
    const answer = response?.answer;

    if (question.type === "multiple_choice") {
      const isProvided = answer !== null && answer !== undefined && answer !== "";
      const picked = isProvided ? Number(answer) : NaN;
      const answered = Number.isInteger(picked) && picked >= 0;
      return {
        answered,
        objective: answered ? picked === question.correctIndex : false,
        display: answered ? (question.options?.[picked] ?? "") : "",
      };
    }

    const text = String(answer ?? "").trim();
    return { answered: text.length > 0, objective: null, display: text };
  });
}

export function fallbackHeatmap(gradedAnswers) {
  const bySubtopic = new Map();

  for (const answer of gradedAnswers) {
    const bucket = bySubtopic.get(answer.subtopic) ?? { right: 0, total: 0 };
    bucket.total += 1;
    if (answer.correct) bucket.right += 1;
    bySubtopic.set(answer.subtopic, bucket);
  }

  return [...bySubtopic.entries()].map(([subtopic, { right, total }]) => {
    const ratio = right / total;
    return {
      subtopic,
      status: ratio === 1 ? "green" : ratio > 0 ? "yellow" : "red",
      feedback: `${right} of ${total} correct on this subtopic.`,
    };
  });
}

export function normalizeQuizResult(raw, questions, graded) {
  const clampScore = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
  const byIndex = new Map(
    (Array.isArray(raw.gradedAnswers) ? raw.gradedAnswers : []).map((entry) => [
      Number(entry?.questionIndex),
      entry,
    ])
  );

  const gradedAnswers = questions.map((question, i) => {
    const fromModel = byIndex.get(i);
    const { answered, objective, display } = graded[i];

    const correct =
      question.type === "multiple_choice"
        ? objective
        : answered && Boolean(fromModel?.correct);

    return {
      questionIndex: i,
      subtopic: question.subtopic,
      type: question.type,
      prompt: question.prompt,
      options: question.options,
      correctIndex: question.correctIndex,
      yourAnswer: display,
      answered,
      correct,
      feedback: String(fromModel?.feedback ?? "").trim(),
    };
  });

  const correctCount = gradedAnswers.filter((a) => a.correct).length;
  const score = clampScore((correctCount / Math.max(1, gradedAnswers.length)) * 100);

  return {
    score,
    correctCount,
    totalCount: gradedAnswers.length,
    gradedAnswers,
    heatmap: Array.isArray(raw.heatmap) && raw.heatmap.length ? raw.heatmap : fallbackHeatmap(gradedAnswers),
  };
}

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
});
