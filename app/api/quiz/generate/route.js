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
- If multiple notes are provided (demarcated by "=== Source Note: ... ==="), synthesize
  concepts across them. Construct questions testing intersections, comparisons, distinctions,
  and cross-concept mechanisms between the notes, while maintaining balanced coverage across all notes.
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
  const questions = (Array.isArray(raw?.questions) ? raw.questions : [])
    .map((q, i) => {
      let type = q?.type;
      if (type !== "multiple_choice" && type !== "short_answer" && type !== "long_answer") {
        type = "multiple_choice";
      }
      const options = (Array.isArray(q?.options) ? q.options : [])
        .map((o) => String(o ?? "").trim())
        .filter(Boolean);

      // A multiple-choice question that lost its options to a malformed
      // generation is unanswerable, so it degrades to short answer rather than
      // rendering as an empty radio group.
      const usable = type === "multiple_choice" && options.length >= 2;
      const finalType = type === "multiple_choice" ? (usable ? "multiple_choice" : "short_answer") : type;
      const index = Number(q?.correctIndex);

      return {
        id: `q${i}`,
        subtopic: String(q?.subtopic ?? "").trim() || "General",
        type: finalType,
        prompt: String(q?.prompt ?? "").trim(),
        options: finalType === "multiple_choice" ? options : [],
        correctIndex:
          finalType === "multiple_choice" && Number.isInteger(index) && index >= 0 && index < options.length
            ? index
            : -1,
        expectedAnswer: String(q?.expectedAnswer ?? "").trim(),
      };
    })
    .filter((q) => q.prompt);

  return {
    topic: String(raw?.topic ?? "").trim() || fallbackTopic,
    questions,
  };
}

/**
 * POST /api/quiz/generate
 *
 * Body: { concept, noteContent, focus, difficulty, mcqCount, shortAnswerCount, longAnswerCount, title }
 * 200 -> { quiz: { topic, questions: [...] }, usage }
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const {
    concept,
    noteContent,
    focus,
    difficulty = "medium",
    mcqCount,
    shortAnswerCount,
    longAnswerCount,
    title,
    syllabus,
    aiPersona,
    strictness,
    academicLevel,
  } = body ?? {};

  if (!concept || typeof concept !== "string" || !concept.trim()) {
    return NextResponse.json({ error: "`concept` is required." }, { status: 400 });
  }

  if (!noteContent || !String(noteContent).trim()) {
    return NextResponse.json(
      { error: "This note is empty — write something before quizzing yourself on it." },
      { status: 400 },
    );
  }

  if (!(await hasApiKey())) {
    return NextResponse.json(
      {
        error:
          "GOOGLE_API_KEY is not set. Add it to .env.local and restart the dev server.",
      },
      { status: 503 },
    );
  }

  const difficultyPrompt = {
    easy: "Difficulty Level: EASY / FOUNDATIONAL. Test core definitions, clear fundamental relationships, and direct applications. Avoid tricky distractors.",
    medium: "Difficulty Level: MEDIUM / STANDARD. Test mechanisms, analytical problems, and standard exam-style questions.",
    hard: "Difficulty Level: HARD / ADVANCED. Test edge cases, subtle distinctions, plausible distractors, and multi-step synthesis.",
    mastery: "Difficulty Level: MASTERY / EXPERT. Test deep conceptual derivations, structural evaluation, and counter-intuitive scenarios.",
  }[difficulty] || "Difficulty Level: MEDIUM.";

  const personaPrompt = {
    strict: "PEDAGOGICAL PERSONA: Strict Examiner. Hold rigorous standards for precise scientific/academic terminology and zero ambiguity.",
    socratic: "PEDAGOGICAL PERSONA: Socratic Guide. Probe the foundational mechanics, counterfactual reasoning, and underlying 'why'.",
    coach: "PEDAGOGICAL PERSONA: Friendly Coach. Emphasize constructive application, approachable phrasing, and conceptual intuition.",
    olympiad: "PEDAGOGICAL PERSONA: Olympiad Mentor. Challenge with non-routine problem solving, multi-variable logic, and synthesis across topics.",
    examiner: "PEDAGOGICAL PERSONA: Standard Examiner. Produce balanced, high-fidelity diagnostic assessment questions.",
  }[aiPersona] || "";

  const strictnessPrompt = {
    rigorous: "DISTRACTOR TOUGHNESS & RIGOR: HIGH RIGOR. Craft deceptively plausible distractors targeting common student misconceptions and inverse relationships.",
    relaxed: "DISTRACTOR TOUGHNESS & RIGOR: RELAXED / FOUNDATIONAL. Make correct answers distinctly verifiable with straightforward distractors.",
    standard: "DISTRACTOR TOUGHNESS & RIGOR: STANDARD. Balanced distractors representing realistic student errors without trick phrasing.",
  }[strictness] || "";

  const academicLevelPrompt = academicLevel && academicLevel !== "general"
    ? `ACADEMIC GRADE LEVEL: ${academicLevel.toUpperCase()}. Calibrate question depth, expected prior knowledge, and terminology strictly to this academic standard.`
    : "";

  const countsSpecified = mcqCount !== undefined || shortAnswerCount !== undefined || longAnswerCount !== undefined;
  const numMCQ = Number.isInteger(Number(mcqCount)) ? Math.max(0, Number(mcqCount)) : 5;
  const numShort = Number.isInteger(Number(shortAnswerCount)) ? Math.max(0, Number(shortAnswerCount)) : 3;
  const numLong = Number.isInteger(Number(longAnswerCount)) ? Math.max(0, Number(longAnswerCount)) : 0;

  const distributionPrompt = countsSpecified
    ? `EXACT QUESTION DISTRIBUTION REQUIREMENT:
Generate exactly ${numMCQ} 'multiple_choice' question(s), ${numShort} 'short_answer' question(s), and ${numLong} 'long_answer' question(s). Total questions = ${numMCQ + numShort + numLong}.`
    : `EXACT QUESTION DISTRIBUTION REQUIREMENT:
Generate exactly 5 'multiple_choice' question(s) and 3 'short_answer' question(s). Total 8 questions.`;

  const focusPrompt = focus && String(focus).trim()
    ? `SPECIFIC FOCUS / SECTION:
Generate questions specifically targeted at this sub-section / focus area from the note: "${String(focus).trim()}".`
    : "";

  const syllabusPrompt = syllabus && String(syllabus).trim()
    ? `ACADEMIC SYLLABUS & CURRICULUM BOUNDARIES (STRICT CONSTRAINT):
<syllabus_statement>
${String(syllabus).trim()}
</syllabus_statement>
CRITICAL REQUIREMENT: Confine all question concepts, definitions, difficulty depth, and expected answers strictly within the learner's syllabus statement above. DO NOT generate questions requiring out-of-syllabus mechanisms, higher-grade concepts, or college-level depth.`
    : "";

  const system = `${PERSONA}

Topic: ${concept.trim()}
${title ? `Quiz Title: ${title.trim()}` : ""}
${personaPrompt}
${strictnessPrompt}
${academicLevelPrompt}
${difficultyPrompt}
${distributionPrompt}
${focusPrompt}
${syllabusPrompt}

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
            "Write the quiz on my notes following the exact difficulty and question type distribution requested. Order the questions logically.",
        },
      ],
      temperature: 0.8,
      schema: QUIZ_SCHEMA,
    });

    const fallbackTopic = title || concept.trim();
    const quiz = normalizeQuiz(readJson(payload), fallbackTopic);

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
