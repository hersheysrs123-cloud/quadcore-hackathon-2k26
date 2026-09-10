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
  const validTypes = [
    "multiple_choice",
    "multi_select",
    "short_answer",
    "long_answer",
    "value_input",
    "code_input",
    "step_ordering",
  ];

  const questions = (Array.isArray(raw?.questions) ? raw.questions : [])
    .map((q, i) => {
      let type = q?.type;
      if (!validTypes.includes(type)) {
        type = "multiple_choice";
      }
      const options = (Array.isArray(q?.options) ? q.options : [])
        .map((o) => String(o ?? "").trim())
        .filter(Boolean);

      let steps = (Array.isArray(q?.steps) ? q.steps : [])
        .map((s) => String(s ?? "").trim())
        .filter(Boolean);

      // If step_ordering doesn't have steps, or has options instead
      if (type === "step_ordering") {
        if (steps.length < 2 && options.length >= 2) {
          steps = [...options];
        }
        if (steps.length < 2) {
          type = "short_answer";
        }
      }

      // For step_ordering, generate scrambled options if empty or matching steps
      let scrambledOptions = options;
      if (type === "step_ordering" && steps.length >= 2) {
        if (scrambledOptions.length !== steps.length || scrambledOptions.every((s, idx) => s === steps[idx])) {
          scrambledOptions = [...steps].reverse();
        }
      }

      // For multi_select, normalize correctIndices
      let correctIndices = [];
      if (type === "multi_select") {
        if (Array.isArray(q?.correctIndices)) {
          correctIndices = q.correctIndices
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

      // A multiple-choice question that lost its options degrades to short answer
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

/**
 * POST /api/quiz/generate
 *
 * Body: { concept, noteContent, focus, difficulty, mcqCount, multiSelectCount, valueInputCount, stepOrderingCount, codeInputCount, shortAnswerCount, longAnswerCount, title, syllabus, aiPersona, strictness, academicLevel }
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
    multiSelectCount,
    valueInputCount,
    stepOrderingCount,
    codeInputCount,
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

  const effectiveAcademicLevel = academicLevel || "igcse_grade_10";
  const academicLevelPrompt = `ACADEMIC STANDARD: ${effectiveAcademicLevel.toUpperCase()}.
Calibrate question depth, expected mathematical precision (e.g. 3 significant figures for IGCSE), and terminology strictly to Cambridge IGCSE Grade 10 standards (Mathematics 0580/0607, Computer Science 0478, Sciences).`;

  const countsSpecified =
    mcqCount !== undefined ||
    multiSelectCount !== undefined ||
    valueInputCount !== undefined ||
    stepOrderingCount !== undefined ||
    codeInputCount !== undefined ||
    shortAnswerCount !== undefined ||
    longAnswerCount !== undefined;

  const numMCQ = Number.isInteger(Number(mcqCount)) ? Math.max(0, Number(mcqCount)) : (countsSpecified ? 0 : 3);
  const numMulti = Number.isInteger(Number(multiSelectCount)) ? Math.max(0, Number(multiSelectCount)) : (countsSpecified ? 0 : 1);
  const numValue = Number.isInteger(Number(valueInputCount)) ? Math.max(0, Number(valueInputCount)) : (countsSpecified ? 0 : 2);
  const numStep = Number.isInteger(Number(stepOrderingCount)) ? Math.max(0, Number(stepOrderingCount)) : (countsSpecified ? 0 : 1);
  const numCode = Number.isInteger(Number(codeInputCount)) ? Math.max(0, Number(codeInputCount)) : 0;
  const numShort = Number.isInteger(Number(shortAnswerCount)) ? Math.max(0, Number(shortAnswerCount)) : (countsSpecified ? 0 : 1);
  const numLong = Number.isInteger(Number(longAnswerCount)) ? Math.max(0, Number(longAnswerCount)) : 0;
  const totalCount = numMCQ + numMulti + numValue + numStep + numCode + numShort + numLong;

  const distributionPrompt = countsSpecified
    ? `EXACT QUESTION DISTRIBUTION REQUIREMENT:
Generate exactly ${totalCount} question(s) with the following distribution:
- ${numMCQ} 'multiple_choice' question(s) (Single correct option out of 4)
- ${numMulti} 'multi_select' question(s) (Check-all-that-apply; 2 or 3 correct options out of 4, with 0-based indices in 'correctIndices')
- ${numValue} 'value_input' question(s) (Exact numerical calculation or algebraic formula; render in LaTeX, expectedAnswer contains exact solution, set 'tolerance' e.g. 0.05 or 0)
- ${numStep} 'step_ordering' question(s) (Logical derivation, proof, or procedure; 'steps' contains 3-6 lines in CORRECT order, 'options' contains scrambled order)
- ${numCode} 'code_input' question(s) (Computer science or math algorithm; provide 'starterCode' skeleton and 'language' like 'python' or 'pseudocode')
- ${numShort} 'short_answer' question(s)
- ${numLong} 'long_answer' question(s)`
    : `EXACT QUESTION DISTRIBUTION REQUIREMENT:
Generate exactly 5 'multiple_choice', 1 'multi_select', and 2 'short_answer' questions. Total 8 questions.`;

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
