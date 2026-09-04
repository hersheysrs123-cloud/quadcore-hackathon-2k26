import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { QUESTION_TYPES, QUIZ_SCHEMA } from "../../lib/schemas.js";

// Extracted deterministic grading implementation mirroring aiService & route
function gradeObjectively(questions, responses) {
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

    if (question.type === "multi_select") {
      const pickedArr = Array.isArray(answer)
        ? answer.map(Number).filter((n) => Number.isInteger(n) && n >= 0)
        : [];
      const answered = pickedArr.length > 0;
      const correctSet = new Set(question.correctIndices || []);
      const pickedSet = new Set(pickedArr);
      const isExactMatch =
        correctSet.size > 0 &&
        correctSet.size === pickedSet.size &&
        [...pickedSet].every((v) => correctSet.has(v));
      const display = pickedArr
        .map((idx) => question.options?.[idx] ?? `Option ${idx + 1}`)
        .join(", ");
      return {
        answered,
        objective: isExactMatch,
        display: answered ? display : "",
      };
    }

    if (question.type === "step_ordering") {
      const studentSteps = Array.isArray(answer)
        ? answer.map((s) => String(s ?? "").trim()).filter(Boolean)
        : [];
      const answered = studentSteps.length >= 2;
      const expectedSteps = (question.steps || []).map((s) => String(s ?? "").trim());
      const isExactMatch =
        answered &&
        expectedSteps.length > 0 &&
        studentSteps.length === expectedSteps.length &&
        studentSteps.every((s, idx) => s === expectedSteps[idx]);
      const display = studentSteps.map((s, idx) => `${idx + 1}. ${s}`).join(" ➔ ");
      return {
        answered,
        objective: isExactMatch,
        display: answered ? display : "",
      };
    }

    if (question.type === "value_input") {
      const text = String(answer ?? "").trim();
      const answered = text.length > 0;
      const clean = text.replace(/^\$|\$$/g, "").trim().toLowerCase();
      const expectedClean = String(question.expectedAnswer ?? "").replace(/^\$|\$$/g, "").trim().toLowerCase();
      let isMatch = clean.length > 0 && clean === expectedClean;
      const numStudent = parseFloat(clean);
      const numExpected = parseFloat(expectedClean);
      if (!isMatch && !isNaN(numStudent) && !isNaN(numExpected)) {
        const tol = typeof question.tolerance === "number" ? Math.max(0, question.tolerance) : 0.01;
        isMatch = Math.abs(numStudent - numExpected) <= tol;
      }
      return {
        answered,
        objective: isMatch ? true : null,
        display: text,
      };
    }

    const text = String(answer ?? "").trim();
    return { answered: text.length > 0, objective: null, display: text };
  });
}

function normalizeQuizForTest(raw, fallbackTopic = "General") {
  const questions = (Array.isArray(raw?.questions) ? raw.questions : [])
    .map((q, i) => {
      let type = QUESTION_TYPES.includes(q?.type) ? q.type : "short_answer";
      const options = Array.isArray(q?.options)
        ? q.options.map((o) => String(o ?? "").trim()).filter(Boolean)
        : [];

      let steps = Array.isArray(q?.steps)
        ? q.steps.map((s) => String(s ?? "").trim()).filter(Boolean)
        : [];
      let scrambledOptions = [...options];

      if (type === "step_ordering") {
        if (steps.length < 2 && options.length >= 2) {
          steps = [...options];
        }
        if (steps.length < 2) {
          type = "short_answer";
        } else {
          if (scrambledOptions.length === 0 || JSON.stringify(scrambledOptions) === JSON.stringify(steps)) {
            scrambledOptions = [...steps].reverse();
          }
        }
      }

      let correctIndices = [];
      if (type === "multi_select") {
        if (Array.isArray(q?.correctIndices)) {
          correctIndices = [...new Set(q.correctIndices)]
            .map(Number)
            .filter((idx) => Number.isInteger(idx) && idx >= 0 && idx < options.length);
        }
        if (correctIndices.length === 0 && Number.isInteger(Number(q?.correctIndex)) && Number(q.correctIndex) >= 0) {
          correctIndices = [Number(q.correctIndex)];
        }
        if (options.length < 2 || correctIndices.length === 0) {
          type = options.length >= 2 ? "multiple_choice" : "short_answer";
        }
      }

      const usable = type === "multiple_choice" && options.length >= 2;
      const finalType = type === "multiple_choice" ? (usable ? "multiple_choice" : "short_answer") : type;
      const index = Number(q?.correctIndex);

      const tolerance =
        finalType === "value_input" && !isNaN(Number(q?.tolerance))
          ? Math.max(0, Number(q.tolerance))
          : 0;

      const starterCode = finalType === "code_input" ? String(q?.starterCode ?? "").trim() : "";
      const language =
        finalType === "code_input" ? String(q?.language ?? "python").trim().toLowerCase() : "";

      return {
        id: `q${i}`,
        subtopic: String(q?.subtopic ?? "").trim() || "General",
        type: finalType,
        prompt: String(q?.prompt ?? "").trim(),
        options:
          finalType === "multiple_choice" || finalType === "multi_select"
            ? options
            : finalType === "step_ordering"
            ? scrambledOptions
            : [],
        correctIndex:
          finalType === "multiple_choice" && Number.isInteger(index) && index >= 0 && index < options.length
            ? index
            : -1,
        correctIndices: finalType === "multi_select" ? correctIndices : [],
        steps: finalType === "step_ordering" ? steps : [],
        starterCode,
        language,
        tolerance,
        expectedAnswer: String(q?.expectedAnswer ?? "").trim(),
      };
    })
    .filter((q) => q.prompt);

  return {
    topic: String(raw?.topic ?? "").trim() || fallbackTopic,
    questions,
  };
}

describe("Cambridge IGCSE Math & STEM Question Types", () => {
  describe("Schema Integrity", () => {
    it("QUESTION_TYPES enum includes all 7 supported question types", () => {
      assert.strictEqual(QUESTION_TYPES.length, 7);
      assert.ok(QUESTION_TYPES.includes("multiple_choice"));
      assert.ok(QUESTION_TYPES.includes("multi_select"));
      assert.ok(QUESTION_TYPES.includes("short_answer"));
      assert.ok(QUESTION_TYPES.includes("long_answer"));
      assert.ok(QUESTION_TYPES.includes("value_input"));
      assert.ok(QUESTION_TYPES.includes("code_input"));
      assert.ok(QUESTION_TYPES.includes("step_ordering"));
    });

    it("QUIZ_SCHEMA defines correct properties for the new question types", () => {
      const itemProps = QUIZ_SCHEMA.properties.questions.items.properties;
      assert.ok(itemProps.correctIndices, "Missing correctIndices property");
      assert.strictEqual(itemProps.correctIndices.type, "ARRAY");
      assert.ok(itemProps.steps, "Missing steps property");
      assert.strictEqual(itemProps.steps.type, "ARRAY");
      assert.ok(itemProps.starterCode, "Missing starterCode property");
      assert.strictEqual(itemProps.starterCode.type, "STRING");
      assert.ok(itemProps.language, "Missing language property");
      assert.strictEqual(itemProps.language.type, "STRING");
      assert.ok(itemProps.tolerance, "Missing tolerance property");
      assert.strictEqual(itemProps.tolerance.type, "NUMBER");
    });
  });

  describe("Quiz Normalization", () => {
    it("normalizes multi_select questions and strips out-of-range indices", () => {
      const raw = {
        topic: "IGCSE Set Theory",
        questions: [
          {
            type: "multi_select",
            prompt: "Which of the following are prime numbers?",
            options: ["2", "4", "7", "9", "11"],
            correctIndices: [0, 2, 4, 99], // 99 out of range
          },
        ],
      };
      const normalized = normalizeQuizForTest(raw);
      assert.strictEqual(normalized.questions.length, 1);
      const q = normalized.questions[0];
      assert.strictEqual(q.type, "multi_select");
      assert.deepStrictEqual(q.correctIndices, [0, 2, 4]);
      assert.strictEqual(q.options.length, 5);
    });

    it("normalizes step_ordering questions and auto-scrambles matching options", () => {
      const raw = {
        topic: "Quadratic Formula Derivation",
        questions: [
          {
            type: "step_ordering",
            prompt: "Order the algebraic steps to complete the square for ax^2 + bx + c = 0:",
            steps: [
              "Divide by a: x^2 + (b/a)x + c/a = 0",
              "Subtract c/a: x^2 + (b/a)x = -c/a",
              "Add (b/2a)^2 to both sides: (x + b/2a)^2 = (b^2 - 4ac)/(4a^2)",
              "Take square root: x + b/2a = \\pm \\frac{\\sqrt{b^2 - 4ac}}{2a}",
              "Solve for x: x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}",
            ],
            options: [
              "Divide by a: x^2 + (b/a)x + c/a = 0",
              "Subtract c/a: x^2 + (b/a)x = -c/a",
              "Add (b/2a)^2 to both sides: (x + b/2a)^2 = (b^2 - 4ac)/(4a^2)",
              "Take square root: x + b/2a = \\pm \\frac{\\sqrt{b^2 - 4ac}}{2a}",
              "Solve for x: x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}",
            ],
          },
        ],
      };
      const normalized = normalizeQuizForTest(raw);
      assert.strictEqual(normalized.questions.length, 1);
      const q = normalized.questions[0];
      assert.strictEqual(q.type, "step_ordering");
      assert.strictEqual(q.steps.length, 5);
      // Scrambled options should not be identical to solved steps
      assert.notDeepStrictEqual(q.options, q.steps);
      assert.strictEqual(q.options[0], q.steps[4]); // Reversed
    });

    it("normalizes value_input questions with custom tolerance", () => {
      const raw = {
        topic: "Trigonometry",
        questions: [
          {
            type: "value_input",
            prompt: "Calculate \\sin(30^\\circ) + \\cos(60^\\circ):",
            expectedAnswer: "1.0",
            tolerance: 0.05,
          },
        ],
      };
      const normalized = normalizeQuizForTest(raw);
      const q = normalized.questions[0];
      assert.strictEqual(q.type, "value_input");
      assert.strictEqual(q.expectedAnswer, "1.0");
      assert.strictEqual(q.tolerance, 0.05);
    });

    it("normalizes code_input questions with starterCode and language", () => {
      const raw = {
        topic: "Cambridge CS 0478 Algorithms",
        questions: [
          {
            type: "code_input",
            prompt: "Write a function `linear_search(arr, target)` that returns the index or -1.",
            starterCode: "def linear_search(arr, target):\n    # TODO\n    pass",
            language: "Python",
            expectedAnswer: "def linear_search(arr, target):\n    for i in range(len(arr)):\n        if arr[i] == target:\n            return i\n    return -1",
          },
        ],
      };
      const normalized = normalizeQuizForTest(raw);
      const q = normalized.questions[0];
      assert.strictEqual(q.type, "code_input");
      assert.strictEqual(q.language, "python");
      assert.ok(q.starterCode.includes("def linear_search"));
      assert.ok(q.expectedAnswer.includes("return i"));
    });
  });

  describe("Objective Grading Engine", () => {
    it("grades multi_select correctly with exact set match and partial failures", () => {
      const question = {
        type: "multi_select",
        prompt: "Select all even prime numbers under 20:",
        options: ["2", "3", "5", "7", "11"],
        correctIndices: [0],
      };

      // Correct selection
      const res1 = gradeObjectively([question], [{ answer: [0] }]);
      assert.strictEqual(res1[0].answered, true);
      assert.strictEqual(res1[0].objective, true);

      // Incorrect selection
      const res2 = gradeObjectively([question], [{ answer: [0, 1] }]);
      assert.strictEqual(res2[0].answered, true);
      assert.strictEqual(res2[0].objective, false);

      // Multi-index question
      const multiQ = {
        type: "multi_select",
        prompt: "Select all irrational numbers:",
        options: ["\\pi", "0.75", "\\sqrt{2}", "\\frac{22}{7}", "e"],
        correctIndices: [0, 2, 4],
      };

      // Exact match with different array ordering
      const res3 = gradeObjectively([multiQ], [{ answer: [4, 0, 2] }]);
      assert.strictEqual(res3[0].objective, true);

      // Incomplete selection
      const res4 = gradeObjectively([multiQ], [{ answer: [0, 2] }]);
      assert.strictEqual(res4[0].objective, false);

      // Empty selection
      const res5 = gradeObjectively([multiQ], [{ answer: [] }]);
      assert.strictEqual(res5[0].answered, false);
      assert.strictEqual(res5[0].objective, false);
    });

    it("grades step_ordering correctly on sequential arrangement", () => {
      const question = {
        type: "step_ordering",
        prompt: "Order steps of binary search:",
        steps: [
          "Find middle element mid = (low + high) // 2",
          "If target == arr[mid], return mid",
          "If target < arr[mid], set high = mid - 1",
          "Else set low = mid + 1",
        ],
      };

      // Correct order
      const res1 = gradeObjectively(
        [question],
        [{
          answer: [
            "Find middle element mid = (low + high) // 2",
            "If target == arr[mid], return mid",
            "If target < arr[mid], set high = mid - 1",
            "Else set low = mid + 1",
          ],
        }]
      );
      assert.strictEqual(res1[0].answered, true);
      assert.strictEqual(res1[0].objective, true);

      // Incorrect step swapped
      const res2 = gradeObjectively(
        [question],
        [{
          answer: [
            "If target == arr[mid], return mid",
            "Find middle element mid = (low + high) // 2",
            "If target < arr[mid], set high = mid - 1",
            "Else set low = mid + 1",
          ],
        }]
      );
      assert.strictEqual(res2[0].answered, true);
      assert.strictEqual(res2[0].objective, false);
    });

    it("grades value_input with exact LaTeX string and numerical tolerance", () => {
      const qLatex = {
        type: "value_input",
        prompt: "Simplify \\frac{x^2 - 1}{x - 1}:",
        expectedAnswer: "x + 1",
        tolerance: 0,
      };

      // Exact match
      const res1 = gradeObjectively([qLatex], [{ answer: "x + 1" }]);
      assert.strictEqual(res1[0].objective, true);

      // Dollar sign stripped match
      const res2 = gradeObjectively([qLatex], [{ answer: "$x + 1$" }]);
      assert.strictEqual(res2[0].objective, true);

      // Numerical tolerance question
      const qNum = {
        type: "value_input",
        prompt: "Find the hypotenuse of triangle with legs 3 and 4:",
        expectedAnswer: "5.0",
        tolerance: 0.05,
      };

      // Within tolerance
      const res3 = gradeObjectively([qNum], [{ answer: "5.02" }]);
      assert.strictEqual(res3[0].objective, true);

      // Exceeds tolerance -> objective returns null (hands off to AI evaluator)
      const res4 = gradeObjectively([qNum], [{ answer: "5.2" }]);
      assert.strictEqual(res4[0].objective, null);
    });

    it("grades code_input by checking non-empty code submissions for AI evaluation", () => {
      const qCode = {
        type: "code_input",
        prompt: "Write factorial in Python:",
        expectedAnswer: "def fact(n):\n    return 1 if n <= 1 else n * fact(n-1)",
      };

      const res1 = gradeObjectively([qCode], [{ answer: "def fact(n):\n    return 1 if n <= 1 else n * fact(n-1)" }]);
      assert.strictEqual(res1[0].answered, true);
      assert.strictEqual(res1[0].objective, null); // Code evaluation is semantic by examiner AI
      assert.ok(res1[0].display.includes("def fact"));

      const res2 = gradeObjectively([qCode], [{ answer: "" }]);
      assert.strictEqual(res2[0].answered, false);
    });
  });
});
