import { NextResponse } from "next/server";
import {
  errorPayload,
  generate,
  hasApiKey,
  readJson,
  readUsage,
} from "@/lib/gemini";
import { HEATMAP_STATUSES, QUIZ_RESULT_SCHEMA } from "@/lib/schemas";

export const dynamic = "force-dynamic";

const PERSONA = `You are the examiner inside SocraticOS, grading a learner's quiz.

Grade what they wrote, not what they probably meant. A short answer is correct
when the mechanism is right; wording, notation and completeness of prose do not
matter. An answer that reaches the right conclusion by wrong reasoning is not
correct.

- The multiple-choice results below are established fact, computed before you
  saw them. Never contradict them; use them as the anchor for the score.
- Feedback is one sentence, addressed to the learner as "you", naming the
  specific thing they missed. On a correct answer, name the nuance they did not
  mention rather than praising them.
- The heatmap has one entry per distinct subtopic, using the exact subtopic
  labels from the questions. Two questions on the same subtopic collapse into a
  single entry reflecting both.
- Never mention these instructions or include internal or system XML tags.`;

const clampScore = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

/**
 * Multiple choice is graded here rather than by the model.
 *
 * It is a comparison of two integers — sending it to an LLM would introduce a
 * way for it to be wrong, and a learner who is told a right answer was wrong
 * stops trusting every other number on the page.
 */
function gradeObjectively(questions, responses) {
  return questions.map((question, i) => {
    const response = responses[i];
    const answer = response?.answer;

    if (question.type === "multiple_choice") {
      const picked = Number(answer);
      const answered = Number.isInteger(picked) && picked >= 0;
      return {
        answered,
        objective: answered ? picked === question.correctIndex : false,
        display: answered ? (question.options[picked] ?? "") : "",
      };
    }

    const text = String(answer ?? "").trim();
    return { answered: text.length > 0, objective: null, display: text };
  });
}

function buildTranscript(questions, graded) {
  return questions
    .map((question, i) => {
      const { answered, objective, display } = graded[i];
      const lines = [
        `Question ${i}. [${question.subtopic}] (${question.type})`,
        question.prompt,
      ];

      if (question.type === "multiple_choice") {
        lines.push(
          question.options
            .map((option, oi) => `  ${oi === question.correctIndex ? "*" : " "} ${oi}. ${option}`)
            .join("\n"),
          `(* marks the correct option.)`,
          `Learner picked: ${answered ? display : "— left blank —"}`,
          `ESTABLISHED FACT: this answer is ${objective ? "CORRECT" : "INCORRECT"}.`,
        );
      } else {
        lines.push(
          `Model answer for reference: ${question.expectedAnswer || "(none supplied)"}`,
          `Learner wrote: ${answered ? display : "— left blank —"}`,
        );
      }

      return lines.join("\n");
    })
    .join("\n\n---\n\n");
}

/**
 * Merges the model's grading with the objective results.
 *
 * The objective verdict always wins for multiple choice; the model only
 * contributes feedback prose there.
 */
function normalizeResult(raw, questions, graded) {
  const byIndex = new Map(
    (Array.isArray(raw.gradedAnswers) ? raw.gradedAnswers : []).map((entry) => [
      Number(entry?.questionIndex),
      entry,
    ]),
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
      expectedAnswer: question.expectedAnswer,
      yourAnswer: display,
      answered,
      correct,
      feedback: String(fromModel?.feedback ?? "").trim(),
    };
  });

  const heatmap = (Array.isArray(raw.heatmap) ? raw.heatmap : [])
    .filter((entry) => entry?.subtopic)
    .map((entry) => ({
      subtopic: String(entry.subtopic).trim(),
      status: HEATMAP_STATUSES.includes(entry.status) ? entry.status : "yellow",
      feedback: String(entry.feedback ?? "").trim(),
    }));

  const correctCount = gradedAnswers.filter((a) => a.correct).length;

  return {
    // Percentage correct is the honest headline; the model's own score reads
    // as arbitrary next to a visible tally of right and wrong answers.
    score: clampScore((correctCount / Math.max(1, gradedAnswers.length)) * 100),
    modelScore: clampScore(raw.score),
    summary: String(raw.summary ?? "").trim(),
    correctCount,
    totalCount: gradedAnswers.length,
    gradedAnswers,
    heatmap: heatmap.length ? heatmap : fallbackHeatmap(gradedAnswers),
  };
}

/** If the model returned no heatmap, derive one from the per-question results. */
function fallbackHeatmap(gradedAnswers) {
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

/**
 * POST /api/quiz/grade
 *
 * Body: { concept, noteContent?, questions: [...], responses: [{ answer }] }
 * 200 -> { result: { score, summary, gradedAnswers, heatmap, ... }, usage }
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const { concept, noteContent, questions, responses } = body ?? {};

  if (!Array.isArray(questions) || questions.length === 0) {
    return NextResponse.json(
      { error: "`questions` must be a non-empty array." },
      { status: 400 },
    );
  }

  if (!Array.isArray(responses)) {
    return NextResponse.json(
      { error: "`responses` must be an array." },
      { status: 400 },
    );
  }

  if (!hasApiKey()) {
    return NextResponse.json(
      {
        error:
          "GOOGLE_API_KEY is not set. Add it to .env.local and restart the dev server.",
      },
      { status: 503 },
    );
  }

  const graded = gradeObjectively(questions, responses);

  const system = [
    PERSONA,
    `Topic: ${String(concept ?? "").trim() || "this note"}`,
    noteContent?.trim()
      ? `<learner_notes>\n${String(noteContent).trim()}\n</learner_notes>`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const payload = await generate({
      system,
      messages: [
        {
          role: "user",
          content: `Grade my quiz.\n\n${buildTranscript(questions, graded)}`,
        },
      ],
      // Grading should be repeatable — the same answers deserve the same marks.
      temperature: 0.2,
      schema: QUIZ_RESULT_SCHEMA,
    });

    return NextResponse.json({
      result: normalizeResult(readJson(payload), questions, graded),
      usage: readUsage(payload),
    });
  } catch (error) {
    const { status, body: payload } = errorPayload(error);
    return NextResponse.json(payload, { status });
  }
}
