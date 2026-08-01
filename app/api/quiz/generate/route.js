import { NextResponse } from "next/server";
import {
  errorPayload,
  generate,
  hasApiKey,
  readJson,
  readUsage,
} from "@/lib/gemini";
import { QUIZ_SCHEMA } from "@/lib/schemas";

export const dynamic = "force-dynamic";

const PERSONA = `You are the examiner inside SocraticOS, a study workspace.

You write short diagnostic quizzes from a learner's own notes. The point is to
find out what they actually understand, so a question they can answer by
spotting a familiar phrase is a wasted question.

Rules:
- Every question must be answerable from the notes by someone who understood
  them, and unanswerable by someone who only skimmed them.
- Test mechanisms, edge cases, and consequences. Never ask for a definition the
  notes state verbatim.
- Where the notes admit confusion about something, write a question on it. That
  is the highest-value thing you can test.
- Distractors must be real mistakes: a plausible confusion, an inverted
  relationship, a right answer to a neighbouring question. Never joke options,
  never "all of the above", never one obviously silly choice.
- Spread correctIndex across positions. Do not favour any one slot.
- Use short_answer for the two questions where seeing their reasoning matters
  most, and multiple_choice for the rest.
- Subtopic labels are what the learner's mastery heatmap groups by, so reuse the
  exact same label across questions that probe the same thing, and keep labels
  specific ("Tax incidence", not "Economics").
- Do not include internal or system XML tags in your response.`;

/** Enforces the invariants the schema cannot express conditionally. */
function normalizeQuiz(raw, fallbackTopic) {
  const questions = (Array.isArray(raw.questions) ? raw.questions : [])
    .map((q, i) => {
      const type = q?.type === "short_answer" ? "short_answer" : "multiple_choice";
      const options = (Array.isArray(q?.options) ? q.options : [])
        .map((o) => String(o ?? "").trim())
        .filter(Boolean);

      // A multiple-choice question that lost its options to a malformed
      // generation is unanswerable, so it degrades to short answer rather than
      // rendering as an empty radio group.
      const usable = type === "multiple_choice" && options.length >= 2;
      const index = Number(q?.correctIndex);

      return {
        id: `q${i}`,
        subtopic: String(q?.subtopic ?? "").trim() || "General",
        type: usable ? "multiple_choice" : "short_answer",
        prompt: String(q?.prompt ?? "").trim(),
        options: usable ? options : [],
        correctIndex:
          usable && Number.isInteger(index) && index >= 0 && index < options.length
            ? index
            : -1,
        expectedAnswer: String(q?.expectedAnswer ?? "").trim(),
      };
    })
    .filter((q) => q.prompt);

  return {
    topic: String(raw.topic ?? "").trim() || fallbackTopic,
    questions,
  };
}

/**
 * POST /api/quiz/generate
 *
 * Body: { concept, noteContent }
 * 200 -> { quiz: { topic, questions: [...] }, usage }
 *
 * The response carries correctIndex and expectedAnswer. The client holds them
 * and posts them back to /api/quiz/grade, which is what keeps grading stateless
 * — there is no server-side quiz to look up. It also means a determined learner
 * could read the answers out of the network tab, which is a trade this app is
 * happy to make: the only person they would be cheating is themselves, and the
 * alternative is a session store that buys nothing else.
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const { concept, noteContent } = body ?? {};

  if (!concept || typeof concept !== "string" || !concept.trim()) {
    return NextResponse.json({ error: "`concept` is required." }, { status: 400 });
  }

  if (!noteContent || !String(noteContent).trim()) {
    return NextResponse.json(
      { error: "This note is empty — write something before quizzing yourself on it." },
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

  const system = `${PERSONA}

Topic: ${concept.trim()}

<learner_notes>
${String(noteContent).trim()}
</learner_notes>`;

  try {
    const payload = await generate({
      system,
      messages: [
        {
          role: "user",
          content:
            "Write the quiz on my notes. Order the questions easiest to hardest.",
        },
      ],
      // Enough variation that re-quizzing the same note is not the same quiz.
      temperature: 0.8,
      schema: QUIZ_SCHEMA,
    });

    const quiz = normalizeQuiz(readJson(payload), concept.trim());

    if (!quiz.questions.length) {
      return NextResponse.json(
        { error: "Could not build a quiz from this note. Try adding more detail to it." },
        { status: 502 },
      );
    }

    return NextResponse.json({ quiz, usage: readUsage(payload) });
  } catch (error) {
    const { status, body: payload } = errorPayload(error);
    return NextResponse.json(payload, { status });
  }
}
